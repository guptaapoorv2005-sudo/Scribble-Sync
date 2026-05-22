import type { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { GAME_DEFAULTS } from "../constants/game";
import { env } from "../config/env";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData
} from "../types/socket";
import type {
  CreateRoomPayload,
  FillAreaPayload,
  JoinRoomPayload,
  QuickPlayPayload
} from "../types/socket";
import type { Stroke } from "../types/game";
import { Player } from "../models/Player";
import { Room } from "../rooms/Room";
import { generateRoomCode } from "../utils/ids";
import { sanitizeName, sanitizeText } from "../utils/sanitize";
import { WordService } from "../services/WordService";
import { GameManager } from "../game/GameManager";
import { TimerManager } from "./TimerManager";

interface RoomEntry {
  room: Room;
  game: GameManager;
  timers: TimerManager;
}

export class RoomManager {
  private readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
  private readonly rooms = new Map<string, RoomEntry>();
  private readonly socketIndex = new Map<
    string,
    { roomCode: string; playerId: string }
  >();
  private readonly wordService: WordService;

  constructor(
    io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
    wordService: WordService
  ) {
    this.io = io;
    this.wordService = wordService;
  }

  public createRoom(
    payload: CreateRoomPayload,
    socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
  ): RoomEntry {
    const roomCode = this.generateUniqueRoomCode();
    const playerName = sanitizeName(payload.playerName);
    if (!playerName) {
      throw new Error("Invalid player name");
    }

    const maxPlayers = payload.maxPlayers ?? env.maxPlayers;
    const settings = {
      maxPlayers,
      roundsPerPlayer: payload.roundsPerPlayer ?? env.roundsPerPlayer,
      roundDurationSec: payload.roundDurationSec ?? env.roundDurationSec,
      chooseDurationSec: payload.chooseDurationSec ?? env.chooseDurationSec,
      hintIntervalSec: payload.hintIntervalSec ?? env.hintIntervalSec,
      wordOptionsCount: payload.wordOptionsCount ?? env.wordOptionsCount,
      maxHints: payload.maxHints ?? env.maxHints
    };

    const room = new Room({
      id: uuidv4(),
      code: roomCode,
      name: sanitizeText(payload.name, 40) || `Room ${roomCode}`,
      isPrivate: payload.isPrivate ?? false,
      maxPlayers,
      hostId: "",
      settings
    });

    const player = new Player({
      id: uuidv4(),
      name: playerName,
      socketId: socket.id,
      isHost: true
    });

    room.hostId = player.id;
    room.addPlayer(player);
    room.turnOrder = room.getConnectedPlayerIds();

    const game = new GameManager(this.io, room, this.wordService);
    const timers = new TimerManager();

    this.rooms.set(room.code, { room, game, timers });
    this.trackSocket(room.code, player.id, socket);
    socket.join(room.code);

    console.log("[ROOM_JOIN]", {
      roomId: room.code,
      socketId: socket.id,
      playerId: player.id,
      rooms: Array.from(socket.rooms.values())
    });

    return { room, game, timers };
  }

  public joinRoom(
    payload: JoinRoomPayload,
    socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
  ): { entry: RoomEntry; player: Player; reconnected: boolean } {
    const roomCode = payload.roomCode.toUpperCase();
    const entry = this.rooms.get(roomCode);
    if (!entry) {
      throw new Error("Room not found");
    }

    const room = entry.room;
    const playerName = sanitizeName(payload.playerName);
    if (!playerName) {
      throw new Error("Invalid player name");
    }

    if (payload.playerId) {
      const existing = room.getPlayer(payload.playerId);
      if (existing) {
        this.rebindSocket(existing, socket, roomCode);
        existing.isConnected = true;
        existing.lastActiveAt = Date.now();
        this.emitPlayerJoin(room, existing, true);
        socket.join(room.code);
        console.log("[ROOM_JOIN]", {
          roomId: room.code,
          socketId: socket.id,
          playerId: existing.id,
          rooms: Array.from(socket.rooms.values())
        });
        return { entry, player: existing, reconnected: true };
      }
    }

    if (room.getPlayers().length >= room.maxPlayers) {
      throw new Error("Room is full");
    }

    const player = new Player({
      id: uuidv4(),
      name: playerName,
      socketId: socket.id
    });

    room.addPlayer(player);
    room.turnOrder = room.getConnectedPlayerIds();
    this.trackSocket(room.code, player.id, socket);
    socket.join(room.code);

    console.log("[ROOM_JOIN]", {
      roomId: room.code,
      socketId: socket.id,
      playerId: player.id,
      rooms: Array.from(socket.rooms.values())
    });

    this.emitPlayerJoin(room, player, false);

    return { entry, player, reconnected: false };
  }

  public quickPlay(
    payload: QuickPlayPayload,
    socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
  ): { entry: RoomEntry; player: Player; reconnected: boolean } {
    const publicRooms = Array.from(this.rooms.values()).filter(({ room }) => {
      if (room.isPrivate) return false;
      return room.getPlayers().length < room.maxPlayers;
    });

    const targetRoom = publicRooms[0]?.room;
    if (targetRoom) {
      return this.joinRoom(
        {
          roomCode: targetRoom.code,
          playerName: payload.playerName
        },
        socket
      );
    }

    const roomName = payload.roomName?.trim() || "Quick Play";
    const entry = this.createRoom(
      {
        name: roomName,
        playerName: payload.playerName,
        isPrivate: false
      },
      socket
    );

    const host = entry.room.getPlayer(entry.room.hostId);
    if (!host) {
      throw new Error("Unable to create room");
    }

    return { entry, player: host, reconnected: false };
  }

  public leaveRoom(
    roomCode: string,
    playerId: string,
    reason: "left" | "timeout" = "left"
  ): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    const player = room.removePlayer(playerId);
    if (!player) return;

    console.log("[PLAYER_REMOVED]", {
      roomId: room.code,
      playerId,
      reason
    });

    room.syncTurnOrder();
    this.socketIndex.forEach((value, socketId) => {
      if (value.playerId === playerId && value.roomCode === roomCode) {
        this.socketIndex.delete(socketId);
      }
    });

    if (room.hostId === playerId) {
      room.ensureHost();
      this.io.to(room.code).emit("host_changed", { hostId: room.hostId });
    }

    const shouldEmit = !(reason === "timeout" && player.isConnected === false);
    if (shouldEmit) {
      this.io.to(room.code).emit("player_left", {
        playerId,
        reason
      });

      const message =
        reason === "disconnected"
          ? `${player.name} disconnected`
          : `${player.name} left the room`;
      this.io.to(room.code).emit("chat_message", {
        id: `sys-${Date.now()}-${player.id}`,
        playerId: null,
        name: "System",
        message,
        isSystem: true,
        type: "system",
        variant: "leave",
        createdAt: Date.now()
      });
    }

    entry.game.handlePlayerRemoved(playerId);

    if (room.getPlayers().length === 0) {
      this.cleanupRoom(room.code);
    }
  }

  public handleDisconnect(socketId: string): void {
    const entry = this.socketIndex.get(socketId);
    if (!entry) return;

    const roomEntry = this.rooms.get(entry.roomCode);
    if (!roomEntry) return;

    const player = roomEntry.room.getPlayer(entry.playerId);
    if (!player) return;

    player.isConnected = false;
    player.lastActiveAt = Date.now();

    roomEntry.timers.setTimeout(
      `disconnect-${player.id}`,
      () => {
        this.leaveRoom(entry.roomCode, player.id, "timeout");
      },
      env.disconnectGraceMs
    );

    this.io.to(entry.roomCode).emit("player_left", {
      playerId: player.id,
      reason: "disconnected"
    });

    this.io.to(entry.roomCode).emit("chat_message", {
      id: `sys-${Date.now()}-${player.id}`,
      playerId: null,
      name: "System",
      message: `${player.name} disconnected`,
      isSystem: true,
      type: "system",
      variant: "leave",
      createdAt: Date.now()
    });

    if (roomEntry.room.hostId === player.id) {
      roomEntry.room.ensureHost();
      this.io.to(entry.roomCode).emit("host_changed", {
        hostId: roomEntry.room.hostId
      });
    }

    roomEntry.game.handlePlayerRemoved(player.id);
  }

  public startGame(roomCode: string, playerId: string): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) throw new Error("Room not found");
    entry.game.startGame(playerId);
  }

  public selectWord(roomCode: string, playerId: string, word: string): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;
    entry.game.selectWord(playerId, word);
  }

  public handleGuess(
    roomCode: string,
    playerId: string,
    socketId: string,
    message: string
  ): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;
    entry.game.handleGuess(playerId, socketId, message);
  }

  public handleChat(
    roomCode: string,
    playerId: string,
    message: string
  ): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    const player = room.getPlayer(playerId);
    if (!player) return;

    const sanitized = sanitizeText(message);
    if (!sanitized) return;

    console.log("[CHAT_BROADCAST]", {
      roomId: room.code,
      socketId: player.socketId,
      playerId: player.id,
      phase: room.phase,
      message: sanitized,
      players: room.getPlayers().map((p) => ({
        id: p.id,
        name: p.name,
        socketId: p.socketId,
        isConnected: p.isConnected
      }))
    });

    this.io.to(room.code).emit("chat_message", {
      id: `chat-${Date.now()}-${player.id}`,
      playerId: player.id,
      name: player.name,
      message: sanitized,
      isSystem: false,
      type: "chat",
      variant: "chat",
      createdAt: Date.now()
    });
  }

  public handleDrawStart(
    roomCode: string,
    playerId: string,
    stroke: Stroke
  ): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    if (room.phase !== "drawing" || room.currentDrawerId !== playerId) {
      console.log("[DRAW_IGNORED]", {
        roomId: room.code,
        socketId: room.getPlayer(playerId)?.socketId ?? null,
        playerId,
        drawerId: room.currentDrawerId,
        phase: room.phase
      });
      return;
    }
    if (room.activeStrokes.has(stroke.id)) return;

    room.activeStrokes.set(stroke.id, stroke);
    console.log("[DRAW_BROADCAST]", {
      roomId: room.code,
      socketId: room.getPlayer(playerId)?.socketId ?? null,
      playerId,
      drawerId: room.currentDrawerId,
      phase: room.phase,
      strokeId: stroke.id,
      point: stroke.points[0]
    });
    console.log("[ROOM_BROADCAST]", {
      roomId: room.code,
      event: "draw_start"
    });
    this.io.to(room.code).emit("draw_start", {
      strokeId: stroke.id,
      point: stroke.points[0],
      color: stroke.color,
      size: stroke.size,
      tool: stroke.tool
    });
  }

  public handleDrawMove(
    roomCode: string,
    playerId: string,
    strokeId: string,
    point: Stroke["points"][0]
  ): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    if (room.phase !== "drawing" || room.currentDrawerId !== playerId) {
      console.log("[DRAW_IGNORED]", {
        roomId: room.code,
        socketId: room.getPlayer(playerId)?.socketId ?? null,
        playerId,
        drawerId: room.currentDrawerId,
        phase: room.phase
      });
      return;
    }

    const stroke = room.activeStrokes.get(strokeId);
    if (!stroke) return;

    stroke.points.push(point);
    console.log("[DRAW_BROADCAST]", {
      roomId: room.code,
      socketId: room.getPlayer(playerId)?.socketId ?? null,
      playerId,
      drawerId: room.currentDrawerId,
      phase: room.phase,
      strokeId,
      point
    });
    console.log("[ROOM_BROADCAST]", {
      roomId: room.code,
      event: "draw_move"
    });
    this.io.to(room.code).emit("draw_move", { strokeId, point });
  }

  public handleDrawEnd(
    roomCode: string,
    playerId: string,
    strokeId: string,
    point: Stroke["points"][0]
  ): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    if (room.phase !== "drawing" || room.currentDrawerId !== playerId) {
      console.log("[DRAW_IGNORED]", {
        roomId: room.code,
        socketId: room.getPlayer(playerId)?.socketId ?? null,
        playerId,
        drawerId: room.currentDrawerId,
        phase: room.phase
      });
      return;
    }

    const stroke = room.activeStrokes.get(strokeId);
    if (!stroke) return;

    stroke.points.push(point);
    room.activeStrokes.delete(strokeId);
    room.strokeHistory.push(stroke);

    console.log("[DRAW_BROADCAST]", {
      roomId: room.code,
      socketId: room.getPlayer(playerId)?.socketId ?? null,
      playerId,
      drawerId: room.currentDrawerId,
      phase: room.phase,
      strokeId,
      point
    });
    console.log("[ROOM_BROADCAST]", {
      roomId: room.code,
      event: "draw_end"
    });
    this.io.to(room.code).emit("draw_end", { strokeId, point });
  }

  public handleDrawUndo(roomCode: string, playerId: string): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    if (room.phase !== "drawing" || room.currentDrawerId !== playerId) {
      console.log("[DRAW_IGNORED]", {
        roomId: room.code,
        socketId: room.getPlayer(playerId)?.socketId ?? null,
        playerId,
        drawerId: room.currentDrawerId,
        phase: room.phase
      });
      return;
    }

    const lastStroke = room.strokeHistory.pop();
    if (!lastStroke) return;

    this.io.to(room.code).emit("draw_undo", { strokeId: lastStroke.id });
  }

  public handleCanvasClear(roomCode: string, playerId: string): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    if (room.phase !== "drawing" || room.currentDrawerId !== playerId) {
      console.log("[DRAW_IGNORED]", {
        roomId: room.code,
        socketId: room.getPlayer(playerId)?.socketId ?? null,
        playerId,
        drawerId: room.currentDrawerId,
        phase: room.phase
      });
      return;
    }

    room.strokeHistory = [];
    room.activeStrokes.clear();
    this.io.to(room.code).emit("canvas_clear");
  }

  public handleFillArea(
    roomCode: string,
    playerId: string,
    payload: FillAreaPayload
  ): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    if (room.phase !== "drawing" || room.currentDrawerId !== playerId) {
      return;
    }

    if (room.strokeHistory.some((stroke) => stroke.id === payload.fillId)) {
      return;
    }

    const fillStroke: Stroke = {
      id: payload.fillId,
      color: payload.fillColor,
      size: 0,
      tool: "fill",
      points: [{ x: payload.x, y: payload.y, t: Date.now() }],
      createdAt: Date.now()
    };

    room.strokeHistory.push(fillStroke);

    this.io.to(room.code).emit("fill_area", {
      fillId: payload.fillId,
      x: payload.x,
      y: payload.y,
      fillColor: payload.fillColor
    });
  }

  public resetToLobby(roomCode: string): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    if (room.phase !== "game_over") return;

    entry.game.clearTimers();
    room.resetRoundState();
    room.resetScores();
    room.phase = "lobby";
    room.roundNumber = 0;
    room.totalRounds = 0;
    room.currentDrawerId = null;
    room.turnIndex = 0;
    room.turnOrder = room.getConnectedPlayerIds();
    room.maskedWord = null;
    room.currentWord = null;
    room.wordOptions = [];
    room.chooseEndsAt = null;
    room.roundEndsAt = null;

    this.io.to(room.code).emit("game_reset", {
      room: room.getPublicState()
    });
  }

  public sendRoomState(
    roomCode: string,
    socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
    playerId: string
  ): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const room = entry.room;
    const player = room.getPlayer(playerId);
    if (!player) return;

    const payload = {
      room: room.getPublicState(),
      playerId: player.id,
      drawerWord: room.currentDrawerId === player.id ? room.currentWord ?? undefined : undefined
    };

    socket.emit("room_joined", payload);

    socket.emit("sync_state", {
      room: payload.room,
      playerId: player.id,
      leaderboard: room.getLeaderboard(),
      strokes: room.strokeHistory,
      drawerWord: payload.drawerWord
    });
  }

  public getRoomBySocket(socketId: string): Room | null {
    const entry = this.socketIndex.get(socketId);
    if (!entry) return null;
    return this.rooms.get(entry.roomCode)?.room ?? null;
  }

  public getPlayerIdBySocket(socketId: string): string | null {
    const entry = this.socketIndex.get(socketId);
    return entry?.playerId ?? null;
  }

  private emitPlayerJoin(room: Room, player: Player, reconnected: boolean): void {
    this.io.to(room.code).emit("player_joined", {
      player: player.toPublic(),
      reconnected
    });

    this.io.to(room.code).emit("chat_message", {
      id: `sys-${Date.now()}-${player.id}`,
      playerId: null,
      name: "System",
      message: reconnected
        ? `${player.name} rejoined the room`
        : `${player.name} joined the room`,
      isSystem: true,
      type: "system",
      variant: "join",
      createdAt: Date.now()
    });
  }

  private rebindSocket(
    player: Player,
    socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
    roomCode: string
  ): void {
    const oldSocketId = player.socketId;
    if (oldSocketId && oldSocketId !== socket.id) {
      this.socketIndex.delete(oldSocketId);
      this.io.to(oldSocketId).emit("socket_error", {
        message: "You were reconnected from another device",
        code: "RECONNECTED"
      });
    }

    player.socketId = socket.id;
    player.isConnected = true;

    const roomEntry = this.rooms.get(roomCode);
    if (roomEntry) {
      roomEntry.timers.clearTimeout(`disconnect-${player.id}`);
    }

    this.trackSocket(roomCode, player.id, socket);
  }

  private trackSocket(
    roomCode: string,
    playerId: string,
    socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
  ): void {
    this.socketIndex.set(socket.id, { roomCode, playerId });
    socket.data.roomCode = roomCode;
    socket.data.playerId = playerId;
  }

  private cleanupRoom(roomCode: string): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    entry.game.clearTimers();
    entry.timers.clearAll();
    this.rooms.delete(roomCode);
    console.log("[ROOM_CLEANUP]", {
      roomId: roomCode,
      remainingRooms: this.rooms.size
    });
  }

  private generateUniqueRoomCode(): string {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }
    return code;
  }
}
