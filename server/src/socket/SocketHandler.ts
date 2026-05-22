import type { Socket, Server } from "socket.io";
import { z } from "zod";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData
} from "../types/socket";
import { validatePayload } from "../utils/validation";
import { RoomManager } from "../managers/RoomManager";

const createRoomSchema = z.object({
  name: z.string().min(1).max(40),
  playerName: z.string().min(1).max(24),
  isPrivate: z.boolean().optional(),
  maxPlayers: z.number().int().min(2).max(20).optional(),
  roundsPerPlayer: z.number().int().min(1).max(10).optional(),
  roundDurationSec: z.number().int().min(30).max(300).optional(),
  chooseDurationSec: z.number().int().min(5).max(60).optional(),
  hintIntervalSec: z.number().int().min(5).max(60).optional(),
  wordOptionsCount: z.number().int().min(2).max(6).optional(),
  maxHints: z.number().int().min(1).max(8).optional()
});

const joinRoomSchema = z.object({
  roomCode: z.string().min(4).max(8),
  playerName: z.string().min(1).max(24),
  playerId: z.string().uuid().optional()
});

const quickPlaySchema = z.object({
  playerName: z.string().min(1).max(24),
  roomName: z.string().min(1).max(40).optional()
});

const leaveRoomSchema = z.object({
  roomCode: z.string().min(4).max(8)
});

const startGameSchema = z.object({
  roomCode: z.string().min(4).max(8)
});

const selectWordSchema = z.object({
  roomCode: z.string().min(4).max(8),
  word: z.string().min(1).max(40)
});

const chatSchema = z.object({
  roomCode: z.string().min(4).max(8),
  message: z.string().min(1).max(200)
});

const guessSchema = z.object({
  roomCode: z.string().min(4).max(8),
  message: z.string().min(1).max(200)
});

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
  t: z.number()
});

const drawStartSchema = z.object({
  roomCode: z.string().min(4).max(8),
  strokeId: z.string().min(4).max(64),
  point: pointSchema,
  color: z.string().min(1).max(20),
  size: z.number().min(0.001).max(1),
  tool: z.enum([
    "pen",
    "brush",
    "eraser",
    "line",
    "rectangle",
    "circle",
    "fill"
  ])
});

const drawMoveSchema = z.object({
  roomCode: z.string().min(4).max(8),
  strokeId: z.string().min(4).max(64),
  point: pointSchema
});

const drawEndSchema = z.object({
  roomCode: z.string().min(4).max(8),
  strokeId: z.string().min(4).max(64),
  point: pointSchema
});

const drawUndoSchema = z.object({
  roomCode: z.string().min(4).max(8)
});

const canvasClearSchema = z.object({
  roomCode: z.string().min(4).max(8)
});

const fillAreaSchema = z.object({
  roomCode: z.string().min(4).max(8),
  fillId: z.string().min(4).max(64),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  fillColor: z.string().min(1).max(20)
});

const returnToLobbySchema = z.object({
  roomCode: z.string().min(4).max(8)
});

const requestStateSchema = z.object({
  roomCode: z.string().min(4).max(8)
});

export class SocketHandler {
  private readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
  private readonly roomManager: RoomManager;

  constructor(
    io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
    roomManager: RoomManager
  ) {
    this.io = io;
    this.roomManager = roomManager;
  }

  public register(): void {
    this.io.on(
      "connection",
      (socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>) => {
        socket.on("create_room", (payload) => {
          if (socket.data.roomCode) {
            this.emitError(socket, "Already in a room");
            return;
          }

          const validation = validatePayload(createRoomSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          try {
            const entry = this.roomManager.createRoom(validation.data, socket);
            socket.emit("room_created", {
              room: entry.room.getPublicState(),
              playerId: entry.room.hostId
            });
          } catch (error) {
            this.emitError(socket, (error as Error).message);
          }
        });

        socket.on("join_room", (payload) => {
          if (socket.data.roomCode) {
            this.emitError(socket, "Already in a room");
            return;
          }

          const validation = validatePayload(joinRoomSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          try {
            const result = this.roomManager.joinRoom(validation.data, socket);
            this.roomManager.sendRoomState(
              result.entry.room.code,
              socket,
              result.player.id
            );
          } catch (error) {
            this.emitError(socket, (error as Error).message);
          }
        });

        socket.on("quick_play", (payload) => {
          if (socket.data.roomCode) {
            this.emitError(socket, "Already in a room");
            return;
          }

          const validation = validatePayload(quickPlaySchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          try {
            const result = this.roomManager.quickPlay(
              validation.data,
              socket
            );
            this.roomManager.sendRoomState(
              result.entry.room.code,
              socket,
              result.player.id
            );
          } catch (error) {
            this.emitError(socket, (error as Error).message);
          }
        });

        socket.on("leave_room", (payload) => {
          const validation = validatePayload(leaveRoomSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId =
            this.roomManager.getPlayerIdBySocket(socket.id) ??
            socket.data.playerId;
          if (!playerId) return;
          const boundRoom = socket.data.roomCode;
          const roomCode = boundRoom
            ? boundRoom
            : this.resolveRoomCode(socket, validation.data.roomCode);
          if (!roomCode) return;

          this.roomManager.leaveRoom(roomCode, playerId);
          socket.leave(roomCode);
          socket.data.roomCode = undefined;
          socket.data.playerId = undefined;
          console.log("[ROOM_LEAVE]", {
            roomId: roomCode,
            socketId: socket.id,
            rooms: Array.from(socket.rooms.values())
          });
        });

        socket.on("start_game", (payload) => {
          const validation = validatePayload(startGameSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) {
            this.emitError(socket, "Player not found");
            return;
          }

          try {
            const roomCode = this.resolveRoomCode(
              socket,
              validation.data.roomCode
            );
            if (!roomCode) return;

            this.roomManager.startGame(roomCode, playerId);
          } catch (error) {
            this.emitError(socket, (error as Error).message);
          }
        });

        socket.on("select_word", (payload) => {
          const validation = validatePayload(selectWordSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.selectWord(roomCode, playerId, validation.data.word);
        });

        socket.on("chat", (payload) => {
          const validation = validatePayload(chatSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.handleChat(
            roomCode,
            playerId,
            validation.data.message
          );
        });

        socket.on("guess", (payload) => {
          const validation = validatePayload(guessSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.handleGuess(
            roomCode,
            playerId,
            socket.id,
            validation.data.message
          );
        });

        socket.on("draw_start", (payload) => {
          const validation = validatePayload(drawStartSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const room = this.roomManager.getRoomBySocket(socket.id);
          console.log("[DRAW_EVENT_RECEIVED]", {
            roomId: validation.data.roomCode,
            socketId: socket.id,
            playerId: this.roomManager.getPlayerIdBySocket(socket.id),
            drawerId: room?.currentDrawerId ?? null,
            phase: room?.phase ?? null,
            strokeId: validation.data.strokeId,
            point: validation.data.point
          });

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.handleDrawStart(roomCode, playerId, {
            id: validation.data.strokeId,
            color: validation.data.color,
            size: validation.data.size,
            tool: validation.data.tool,
            points: [validation.data.point],
            createdAt: Date.now()
          });
        });

        socket.on("draw_move", (payload) => {
          const validation = validatePayload(drawMoveSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const room = this.roomManager.getRoomBySocket(socket.id);
          console.log("[DRAW_EVENT_RECEIVED]", {
            roomId: validation.data.roomCode,
            socketId: socket.id,
            playerId: this.roomManager.getPlayerIdBySocket(socket.id),
            drawerId: room?.currentDrawerId ?? null,
            phase: room?.phase ?? null,
            strokeId: validation.data.strokeId,
            point: validation.data.point
          });

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.handleDrawMove(
            roomCode,
            playerId,
            validation.data.strokeId,
            validation.data.point
          );
        });

        socket.on("draw_end", (payload) => {
          const validation = validatePayload(drawEndSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const room = this.roomManager.getRoomBySocket(socket.id);
          console.log("[DRAW_EVENT_RECEIVED]", {
            roomId: validation.data.roomCode,
            socketId: socket.id,
            playerId: this.roomManager.getPlayerIdBySocket(socket.id),
            drawerId: room?.currentDrawerId ?? null,
            phase: room?.phase ?? null,
            strokeId: validation.data.strokeId,
            point: validation.data.point
          });

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.handleDrawEnd(
            roomCode,
            playerId,
            validation.data.strokeId,
            validation.data.point
          );
        });

        socket.on("draw_undo", (payload) => {
          const validation = validatePayload(drawUndoSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.handleDrawUndo(roomCode, playerId);
        });

        socket.on("canvas_clear", (payload) => {
          const validation = validatePayload(canvasClearSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.handleCanvasClear(roomCode, playerId);
        });

        socket.on("fill_area", (payload) => {
          const validation = validatePayload(fillAreaSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.handleFillArea(roomCode, playerId, validation.data);
        });

        socket.on("return_to_lobby", (payload) => {
          const validation = validatePayload(returnToLobbySchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.resetToLobby(roomCode);
        });

        socket.on("request_state", (payload) => {
          const validation = validatePayload(requestStateSchema, payload);
          if (!validation.ok) {
            this.emitError(socket, validation.error);
            return;
          }

          const playerId = this.roomManager.getPlayerIdBySocket(socket.id);
          if (!playerId) return;
          const roomCode = this.resolveRoomCode(
            socket,
            validation.data.roomCode
          );
          if (!roomCode) return;

          this.roomManager.sendRoomState(roomCode, socket, playerId);
        });

        socket.on("disconnect", () => {
          this.roomManager.handleDisconnect(socket.id);
        });
      }
    );
  }

  private emitError(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    message: string
  ): void {
    socket.emit("socket_error", {
      message,
      code: "BAD_REQUEST"
    });
  }

  private resolveRoomCode(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
    requestedCode: string
  ): string | null {
    const normalized = requestedCode.toUpperCase();
    const bound = socket.data.roomCode;
    if (bound && bound !== normalized) {
      this.emitError(socket, "Room mismatch");
      return null;
    }

    return normalized;
  }
}
