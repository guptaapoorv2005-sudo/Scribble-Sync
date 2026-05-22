import type { Server } from "socket.io";
import { GAME_DEFAULTS, SCORING } from "../constants/game";
import type {
  ServerToClientEvents,
  SocketData,
  ClientToServerEvents
} from "../types/socket";
import type { Room } from "../rooms/Room";
import type { WordService } from "../services/WordService";
import { TimerManager } from "../managers/TimerManager";
import { normalizeGuess, sanitizeText } from "../utils/sanitize";

export class GameManager {
  private readonly timers: TimerManager;
  private readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
  private readonly room: Room;
  private readonly wordService: WordService;

  constructor(
    io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
    room: Room,
    wordService: WordService
  ) {
    this.io = io;
    this.room = room;
    this.wordService = wordService;
    this.timers = new TimerManager();
  }

  public startGame(initiatorId: string): void {
    if (this.room.phase !== "lobby") {
      throw new Error("Game already started");
    }

    if (initiatorId !== this.room.hostId) {
      throw new Error("Only the host can start the game");
    }

    if (!this.room.canStartGame()) {
      throw new Error("Not enough players to start the game");
    }

    this.room.resetScores();
    this.room.turnOrder = this.room.getConnectedPlayerIds();
    this.room.turnIndex = 0;
    this.room.roundNumber = 0;
    this.room.totalRounds = this.room.settings.rounds;

    this.logState("[ROOM_STATE]", { initiatorId });

    this.io.to(this.room.code).emit("game_started", {
      room: this.room.getPublicState()
    });

    this.startNextRound();
  }

  public selectWord(playerId: string, word: string, isAuto = false): void {
    if (this.room.phase !== "choosing") {
      return;
    }

    if (playerId !== this.room.currentDrawerId) {
      return;
    }

    const normalized = this.wordService.normalize(word);
    const selected =
      this.room.wordOptions.find(
        (option) => this.wordService.normalize(option) === normalized
      ) ?? (isAuto ? word : null);

    if (!selected) {
      return;
    }

    this.logState("[WORD_CHOSEN]", {
      playerId,
      selected,
      isAuto
    });

    this.room.currentWord = selected;
    this.room.maskedWord = this.wordService.getMaskedWord(
      selected,
      this.room.revealedIndices
    );
    this.room.phase = "drawing";
    this.room.chooseEndsAt = null;

    this.logState("[PHASE_CHANGED]", { phase: this.room.phase });

    const roundDurationMs = this.room.settings.drawTime * 1000;
    this.room.roundEndsAt = Date.now() + roundDurationMs;

    this.timers.clearTimeout("choose_timeout");
    this.timers.clearInterval("choose_tick");

    const drawerSocketId = this.room.getPlayer(playerId)?.socketId;
    const broadcastPayload = {
      maskedWord: this.room.maskedWord,
      wordLength: selected.length,
      drawerId: playerId,
      roundDurationSec: this.room.settings.drawTime
    };

    if (drawerSocketId) {
      this.io
        .to(this.room.code)
        .except(drawerSocketId)
        .emit("word_selected", broadcastPayload);
      this.io.to(drawerSocketId).emit("word_selected", {
        ...broadcastPayload,
        word: selected
      });
    } else {
      this.io.to(this.room.code).emit("word_selected", broadcastPayload);
    }

    this.timers.setInterval("round_tick", () => {
      const timeLeftSec = this.getTimeLeftSec();
      if (timeLeftSec === null) return;
      this.io.to(this.room.code).emit("timer_tick", {
        timeLeftSec,
        phase: this.room.phase
      });
    }, 1000);

    this.timers.setTimeout("round_timeout", () => {
      this.endRound("time_up");
    }, roundDurationMs);

    if (this.room.settings.hintsEnabled && this.room.settings.hintCount > 0) {
      const hintIntervalMs = Math.max(5, Math.floor(this.room.settings.drawTime / (this.room.settings.hintCount + 1))) * 1000;
      this.timers.setInterval("hint_tick", () => {
        if (!this.room.currentWord) return;
        const revealed = this.wordService.revealRandomLetter(
          this.room.currentWord,
          this.room.revealedIndices,
          this.room.settings.hintCount
        );
        if (!revealed) {
          this.timers.clearInterval("hint_tick");
          return;
        }

        this.room.maskedWord = this.wordService.getMaskedWord(
          this.room.currentWord,
          this.room.revealedIndices
        );

        this.io.to(this.room.code).emit("hint_update", {
          maskedWord: this.room.maskedWord,
          revealedCount: this.room.revealedIndices.size
        });
      }, hintIntervalMs);
    }
  }

  public handleGuess(playerId: string, socketId: string, message: string): void {
    this.logState("[GUESS_RECEIVED]", {
      playerId,
      socketId,
      message
    });
    if (this.room.phase !== "drawing" || !this.room.currentWord) {
      this.io.to(socketId).emit("guess_result", { correct: false });
      return;
    }

    if (playerId === this.room.currentDrawerId) {
      this.io.to(socketId).emit("guess_result", { correct: false });
      return;
    }

    const player = this.room.getPlayer(playerId);
    if (!player || player.hasGuessedCorrectly) {
      this.io.to(socketId).emit("guess_result", {
        correct: false,
        alreadyGuessed: true
      });
      return;
    }

    const guess = normalizeGuess(message);
    if (!guess) {
      this.io.to(socketId).emit("guess_result", { correct: false });
      return;
    }

    const normalizedWord = this.wordService.normalize(this.room.currentWord);
    if (guess === normalizedWord) {
      const timeLeftSec = this.getTimeLeftSec() ?? 0;
      const score = this.calculateGuessScore(timeLeftSec);

      player.score += score;
      player.hasGuessedCorrectly = true;
      this.room.guessedPlayerIds.add(player.id);

      const drawer = this.room.currentDrawerId
        ? this.room.getPlayer(this.room.currentDrawerId)
        : undefined;
      if (drawer) {
        drawer.score += Math.floor(score * SCORING.drawerShare);
      }

      this.io.to(socketId).emit("guess_result", {
        correct: true,
        pointsAwarded: score
      });

      this.io.to(this.room.code).emit("guess_result", {
        playerId: player.id,
        correct: true
      });

      this.io.to(this.room.code).emit("chat_message", {
        id: `sys-${Date.now()}`,
        playerId: null,
        name: "System",
        message: `${player.name} guessed the word!`,
        isSystem: true,
        type: "system",
        variant: "correct_guess",
        createdAt: Date.now()
      });

      this.broadcastLeaderboard();

      const nonDrawers = this.room
        .getConnectedPlayers()
        .filter((p) => p.id !== this.room.currentDrawerId);
      const allGuessed = nonDrawers.every((p) => p.hasGuessedCorrectly);
      if (allGuessed) {
        this.endRound("all_guessed");
      }
      return;
    }

    const sanitized = sanitizeText(message);
    if (sanitized) {
      this.logState("[CHAT_BROADCAST]", {
        playerId,
        message: sanitized
      });
      this.io.to(this.room.code).emit("chat_message", {
        id: `chat-${Date.now()}-${player.id}`,
        playerId: player.id,
        name: player.name,
        message: sanitized,
        isSystem: false,
        type: "chat",
        variant: "guess",
        createdAt: Date.now()
      });
    }

    this.io.to(socketId).emit("guess_result", { correct: false });
  }

  public handlePlayerRemoved(playerId: string): void {
    if (this.room.currentDrawerId === playerId) {
      this.endRound("drawer_left");
    }

    this.room.syncTurnOrder();

    if (this.room.phase !== "lobby") {
      const connected = this.room.getConnectedPlayers();
      if (connected.length < GAME_DEFAULTS.minPlayers) {
        this.endRound("not_enough_players");
        this.endGame();
      }
    }
  }

  public endRound(
    reason: "time_up" | "all_guessed" | "drawer_left" | "not_enough_players"
  ): void {
    if (this.room.phase === "round_end" || this.room.phase === "game_over") {
      return;
    }

    this.room.phase = "round_end";
    this.logState("[PHASE_CHANGED]", { phase: this.room.phase, reason });
    this.timers.clearInterval("round_tick");
    this.timers.clearInterval("hint_tick");
    this.timers.clearTimeout("round_timeout");
    this.timers.clearTimeout("choose_timeout");

    const wordToReveal = this.room.currentWord ?? "";

    this.io.to(this.room.code).emit("round_ended", {
      reason,
      word: wordToReveal,
      leaderboard: this.room.getLeaderboard()
    });

    this.timers.setTimeout("round_transition", () => {
      if (this.room.phase === "game_over") return;
      this.startNextRound();
    }, GAME_DEFAULTS.roundEndDelaySec * 1000);
  }

  public endGame(): void {
    if (this.room.phase === "game_over") return;
    this.room.phase = "game_over";
    this.logState("[PHASE_CHANGED]", { phase: this.room.phase });
    this.timers.clearAll();

    const leaderboard = this.room.getLeaderboard();
    const winnerId = leaderboard[0]?.playerId ?? null;

    this.io.to(this.room.code).emit("game_over", {
      leaderboard,
      winnerId
    });
  }

  public startNextRound(): void {
    if (this.room.getConnectedPlayers().length < GAME_DEFAULTS.minPlayers) {
      this.endGame();
      return;
    }

    this.room.syncTurnOrder();
    if (!this.room.turnOrder.length) {
      this.endGame();
      return;
    }

    this.room.totalRounds = this.room.settings.rounds;

    if (this.room.roundNumber >= this.room.totalRounds) {
      this.endGame();
      return;
    }

    this.room.resetRoundState();
    const drawerId = this.getNextDrawerId();
    this.room.currentDrawerId = drawerId;
    this.room.roundNumber += 1;
    this.room.phase = "choosing";
    this.room.wordOptions = this.wordService.getRandomWords(
      this.room.settings.wordChoices
    );

    this.logState("[ROUND_START]", {
      roundNumber: this.room.roundNumber,
      totalRounds: this.room.totalRounds
    });
    this.logState("[DRAWER_ASSIGNED]", { drawerId });

    const chooseDurationMs = 10_000;
    this.room.chooseEndsAt = Date.now() + chooseDurationMs;

    this.io.to(this.room.code).emit("round_started", {
      roomCode: this.room.code,
      roundNumber: this.room.roundNumber,
      totalRounds: this.room.totalRounds,
      drawerId,
      phase: this.room.phase,
      chooseDurationSec: Math.floor(chooseDurationMs / 1000)
    });

    const drawerSocketId = this.room.getPlayer(drawerId)?.socketId;
    if (drawerSocketId) {
      this.io.to(drawerSocketId).emit("word_options", {
        options: this.room.wordOptions,
        chooseDurationSec: Math.floor(chooseDurationMs / 1000)
      });
    }

    this.logState("[WORD_OPTIONS_SENT]", {
      drawerId,
      drawerSocketId: drawerSocketId ?? null,
      options: this.room.wordOptions
    });

    this.timers.setTimeout("choose_timeout", () => {
      const autoWord =
        this.room.wordOptions[Math.floor(Math.random() * this.room.wordOptions.length)] ??
        this.wordService.getRandomWords(1)[0];
      this.selectWord(drawerId, autoWord, true);
    }, chooseDurationMs);

    this.timers.setInterval("choose_tick", () => {
      const timeLeftSec = this.getTimeLeftSec();
      if (timeLeftSec === null) return;
      this.io.to(this.room.code).emit("timer_tick", {
        timeLeftSec,
        phase: this.room.phase
      });
    }, 1000);
  }

  public clearTimers(): void {
    this.timers.clearAll();
  }

  private getNextDrawerId(): string {
    const order = this.room.turnOrder;
    if (!order.length) return this.room.hostId;

    for (let attempt = 0; attempt < order.length; attempt += 1) {
      const index = this.room.turnIndex % order.length;
      const drawerId = order[index];
      this.room.turnIndex = (this.room.turnIndex + 1) % order.length;
      const player = this.room.getPlayer(drawerId);
      if (player?.isConnected) {
        return drawerId;
      }
    }

    return this.room.hostId;
  }

  private getTimeLeftSec(): number | null {
    return this.room.getTimeLeftSec();
  }

  private calculateGuessScore(timeLeftSec: number): number {
    const duration = this.room.settings.drawTime;
    const ratio = duration > 0 ? timeLeftSec / duration : 0;
    const score = Math.round(SCORING.base + SCORING.bonus * ratio);
    return Math.max(score, SCORING.minGuessScore);
  }

  private broadcastLeaderboard(): void {
    this.io.to(this.room.code).emit("leaderboard_update", {
      leaderboard: this.room.getLeaderboard()
    });
  }

  private logState(tag: string, details: Record<string, unknown>): void {
    console.log(tag, {
      roomId: this.room.code,
      phase: this.room.phase,
      currentDrawerId: this.room.currentDrawerId,
      roundNumber: this.room.roundNumber,
      players: this.room.getPlayers().map((player) => ({
        id: player.id,
        name: player.name,
        socketId: player.socketId,
        isConnected: player.isConnected,
        score: player.score,
        hasGuessedCorrectly: player.hasGuessedCorrectly
      })),
      ...details
    });
  }
}
