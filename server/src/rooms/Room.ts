import type { GamePhase, Stroke } from "../types/game";
import type {
  LeaderboardEntry,
  PlayerPublic,
  RoomPublicState,
  RoomSettings
} from "../types/room";
import { GAME_DEFAULTS } from "../constants/game";
import { Player } from "../models/Player";

export class Room {
  public readonly id: string;
  public readonly code: string;
  public name: string;
  public isPublic: boolean;
  public isPrivate: boolean;
  public hostId: string;
  public phase: GamePhase;
  public players: Map<string, Player>;
  public turnOrder: string[];
  public turnIndex: number;
  public roundNumber: number;
  public totalRounds: number;
  public currentDrawerId: string | null;
  public currentWord: string | null;
  public maskedWord: string | null;
  public wordOptions: string[];
  public guessedPlayerIds: Set<string>;
  public revealedIndices: Set<number>;
  public strokeHistory: Stroke[];
  public activeStrokes: Map<string, Stroke>;
  public chooseEndsAt: number | null;
  public roundEndsAt: number | null;
  public settings: RoomSettings;
  public createdAt: number;

  constructor(params: {
    id: string;
    code: string;
    name: string;
    isPublic: boolean;
    isPrivate: boolean;
    hostId: string;
    settings: RoomSettings;
  }) {
    this.id = params.id;
    this.code = params.code;
    this.name = params.name;
    this.isPublic = params.isPublic;
    this.isPrivate = params.isPrivate;
    this.hostId = params.hostId;
    this.phase = "lobby";
    this.players = new Map();
    this.turnOrder = [];
    this.turnIndex = 0;
    this.roundNumber = 0;
    this.totalRounds = 0;
    this.currentDrawerId = null;
    this.currentWord = null;
    this.maskedWord = null;
    this.wordOptions = [];
    this.guessedPlayerIds = new Set();
    this.revealedIndices = new Set();
    this.strokeHistory = [];
    this.activeStrokes = new Map();
    this.chooseEndsAt = null;
    this.roundEndsAt = null;
    this.settings = params.settings;
    this.createdAt = Date.now();
  }

  public addPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  public removePlayer(playerId: string): Player | undefined {
    const existing = this.players.get(playerId);
    this.players.delete(playerId);
    return existing;
  }

  public getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  public getPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  public getConnectedPlayers(): Player[] {
    return this.getPlayers().filter((player) => player.isConnected);
  }

  public getConnectedPlayerIds(): string[] {
    return this.getConnectedPlayers().map((player) => player.id);
  }

  public resetRoundState(): void {
    this.currentWord = null;
    this.maskedWord = null;
    this.wordOptions = [];
    this.guessedPlayerIds.clear();
    this.revealedIndices.clear();
    this.strokeHistory = [];
    this.activeStrokes.clear();
    this.chooseEndsAt = null;
    this.roundEndsAt = null;
    this.players.forEach((player) => {
      player.hasGuessedCorrectly = false;
    });
  }

  public resetScores(): void {
    this.players.forEach((player) => {
      player.score = 0;
      player.hasGuessedCorrectly = false;
    });
  }

  public syncTurnOrder(): void {
    const activeIds = new Set(this.getPlayers().map((player) => player.id));
    this.turnOrder = this.turnOrder.filter((id) => activeIds.has(id));
  }

  public ensureHost(): void {
    const existingHost = this.players.get(this.hostId);
    if (existingHost) {
      return;
    }

    const nextHost = this.getConnectedPlayers()[0] ?? this.getPlayers()[0];
    if (!nextHost) return;

    this.players.forEach((player) => {
      player.isHost = false;
    });
    this.hostId = nextHost.id;
    nextHost.isHost = true;
  }

  public getTimeLeftSec(): number | null {
    const now = Date.now();
    if (this.phase === "drawing" && this.roundEndsAt) {
      return Math.max(0, Math.ceil((this.roundEndsAt - now) / 1000));
    }
    if (this.phase === "choosing" && this.chooseEndsAt) {
      return Math.max(0, Math.ceil((this.chooseEndsAt - now) / 1000));
    }
    return null;
  }

  public getPublicState(): RoomPublicState {
    const wordLength = this.currentWord ? this.currentWord.length : 0;
    return {
      roomCode: this.code,
      name: this.name,
      isPublic: this.isPublic,
      isPrivate: this.isPrivate,
      hostId: this.hostId,
      phase: this.phase,
      roundNumber: this.roundNumber,
      totalRounds: this.totalRounds,
      currentDrawerId: this.currentDrawerId,
      maskedWord: this.maskedWord,
      wordLength,
      players: this.getPlayers().map((player) => player.toPublic()),
      settings: this.settings,
      timeLeftSec: this.getTimeLeftSec()
    };
  }

  public getLeaderboard(): LeaderboardEntry[] {
    const sorted = this.getPlayers()
      .slice()
      .sort((a, b) => b.score - a.score);

    return sorted.map((player, index) => ({
      playerId: player.id,
      name: player.name,
      score: player.score,
      rank: index + 1
    }));
  }

  public getPublicPlayers(): PlayerPublic[] {
    return this.getPlayers().map((player) => player.toPublic());
  }

  public canStartGame(): boolean {
    return this.getConnectedPlayers().length >= GAME_DEFAULTS.minPlayers;
  }

  public isJoinable(): boolean {
    return this.getPlayers().length < this.settings.maxPlayers && this.phase !== "game_over";
  }
}
