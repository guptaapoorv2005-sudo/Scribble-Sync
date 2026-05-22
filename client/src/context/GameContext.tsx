import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import type { Stroke } from "../types/game";
import type {
  ChatMessagePayload,
  DrawEndBroadcast,
  DrawMoveBroadcast,
  DrawStartBroadcast,
  FillAreaBroadcast,
  GuessResultPayload,
  RoundEndedPayload
} from "../types/socket";
import type { LeaderboardEntry } from "../types/room";
import { useSocketContext } from "./SocketContext";
import { useRoomContext } from "./RoomContext";
import { createId } from "../utils/ids";

export interface GuessFeedback {
  correct: boolean;
  pointsAwarded?: number;
  alreadyGuessed?: boolean;
}

export interface RoundSummary {
  reason: RoundEndedPayload["reason"];
  word: string;
  leaderboard: LeaderboardEntry[];
}

export interface GameOverState {
  leaderboard: LeaderboardEntry[];
  winnerId: string | null;
}

export interface GuessNotification {
  id: string;
  message: string;
  tone: "info" | "success" | "danger";
}

interface GameContextValue {
  strokes: Stroke[];
  activeStrokes: Stroke[];
  wordOptions: string[];
  chatMessages: ChatMessagePayload[];
  leaderboard: LeaderboardEntry[];
  roundSummary: RoundSummary | null;
  gameOver: GameOverState | null;
  guessFeedback: GuessFeedback | null;
  hasGuessedCorrectly: boolean;
  notifications: GuessNotification[];
  sendChat: (message: string) => void;
  sendGuess: (message: string) => void;
  sendDrawStart: (stroke: Stroke) => void;
  sendDrawMove: (strokeId: string, point: Stroke["points"][0]) => void;
  sendDrawEnd: (strokeId: string, point: Stroke["points"][0]) => void;
  sendUndo: () => void;
  sendCanvasClear: () => void;
  sendFillArea: (payload: { x: number; y: number; fillColor: string }) => void;
  selectWord: (word: string) => void;
  dismissRoundSummary: () => void;
  dismissGameOver: () => void;
  clearNotifications: () => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocketContext();
  const { room } = useRoomContext();

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStrokes, setActiveStrokes] = useState<Map<string, Stroke>>(
    () => new Map()
  );
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [gameOver, setGameOver] = useState<GameOverState | null>(null);
  const [guessFeedback, setGuessFeedback] = useState<GuessFeedback | null>(null);
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);
  const [notifications, setNotifications] = useState<GuessNotification[]>([]);

  const localStrokeIds = useRef<Set<string>>(new Set());
  const localFillIds = useRef<Set<string>>(new Set());
  const roomRef = useRef(room);
  const notificationTimeouts = useRef<Map<string, number>>(new Map());

  const roomCode = room?.roomCode ?? "";

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((note) => note.id !== id));
    const timeoutId = notificationTimeouts.current.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      notificationTimeouts.current.delete(id);
    }
  }, []);

  const addNotification = useCallback(
    (message: string, tone: "info" | "success" | "danger") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setNotifications((current) => [
        { id, message, tone },
        ...current.slice(0, 4)
      ]);
      const timeoutId = window.setTimeout(() => {
        removeNotification(id);
      }, 3000);
      notificationTimeouts.current.set(id, timeoutId);
    },
    [removeNotification]
  );

  const clearNotifications = useCallback(() => {
    notificationTimeouts.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    notificationTimeouts.current.clear();
    setNotifications([]);
  }, []);

  const applyDrawStart = useCallback((payload: DrawStartBroadcast) => {
    setActiveStrokes((current) => {
      if (current.has(payload.strokeId)) return current;
      const next = new Map(current);
      next.set(payload.strokeId, {
        id: payload.strokeId,
        color: payload.color,
        size: payload.size,
        tool: payload.tool,
        points: [payload.point],
        createdAt: payload.point.t
      });
      return next;
    });
  }, []);

  const applyDrawMove = useCallback((payload: DrawMoveBroadcast) => {
    setActiveStrokes((current) => {
      const existing = current.get(payload.strokeId);
      if (!existing) return current;
      const next = new Map(current);
      next.set(payload.strokeId, {
        ...existing,
        points: [...existing.points, payload.point]
      });
      return next;
    });
  }, []);

  const applyDrawEnd = useCallback((payload: DrawEndBroadcast) => {
    setActiveStrokes((current) => {
      const existing = current.get(payload.strokeId);
      if (!existing) return current;
      const next = new Map(current);
      const completed: Stroke = {
        ...existing,
        points: [...existing.points, payload.point]
      };
      next.delete(payload.strokeId);
      setStrokes((history) => [...history, completed]);
      return next;
    });
  }, []);

  const sendDrawStart = useCallback(
    (stroke: Stroke) => {
      if (!socket || !roomCode) return;
      console.log("[DRAW_EMIT]", {
        event: "draw_start",
        roomId: roomCode,
        socketId: socket.id,
        strokeId: stroke.id,
        point: stroke.points[0]
      });
      console.log("[DRAW_START_EMIT]", {
        roomId: roomCode,
        socketId: socket.id,
        strokeId: stroke.id,
        point: stroke.points[0],
        tool: stroke.tool,
        size: stroke.size,
        color: stroke.color
      });
      console.debug("[CLIENT][EMIT] draw_start", {
        roomCode,
        strokeId: stroke.id,
        socketId: socket.id
      });
      localStrokeIds.current.add(stroke.id);
      setActiveStrokes((current) => {
        const next = new Map(current);
        next.set(stroke.id, stroke);
        return next;
      });
      socket.emit("draw_start", {
        roomCode,
        strokeId: stroke.id,
        point: stroke.points[0],
        color: stroke.color,
        size: stroke.size,
        tool: stroke.tool
      });
    },
    [socket, roomCode]
  );

  const sendDrawMove = useCallback(
    (strokeId: string, point: Stroke["points"][0]) => {
      if (!socket || !roomCode) return;
      console.log("[DRAW_EMIT]", {
        event: "draw_move",
        roomId: roomCode,
        socketId: socket.id,
        strokeId,
        point
      });
      console.log("[DRAW_MOVE_EMIT]", {
        roomId: roomCode,
        socketId: socket.id,
        strokeId,
        point
      });
      console.debug("[CLIENT][EMIT] draw_move", {
        roomCode,
        strokeId,
        socketId: socket.id
      });
      setActiveStrokes((current) => {
        const existing = current.get(strokeId);
        if (!existing) return current;
        const next = new Map(current);
        next.set(strokeId, {
          ...existing,
          points: [...existing.points, point]
        });
        return next;
      });
      socket.emit("draw_move", { roomCode, strokeId, point });
    },
    [socket, roomCode]
  );

  const sendDrawEnd = useCallback(
    (strokeId: string, point: Stroke["points"][0]) => {
      if (!socket || !roomCode) return;
      console.debug("[CLIENT][EMIT] draw_end", {
        roomCode,
        strokeId,
        socketId: socket.id
      });
      localStrokeIds.current.delete(strokeId);
      setActiveStrokes((current) => {
        const existing = current.get(strokeId);
        if (!existing) return current;
        const next = new Map(current);
        next.delete(strokeId);
        setStrokes((history) => [
          ...history,
          {
            ...existing,
            points: [...existing.points, point]
          }
        ]);
        return next;
      });
      socket.emit("draw_end", { roomCode, strokeId, point });
    },
    [socket, roomCode]
  );

  const sendUndo = useCallback(() => {
    if (!socket || !roomCode) return;
    console.debug("[CLIENT][EMIT] draw_undo", {
      roomCode,
      socketId: socket.id
    });
    socket.emit("draw_undo", { roomCode });
    setStrokes((current) => current.slice(0, -1));
  }, [socket, roomCode]);

  const sendCanvasClear = useCallback(() => {
    if (!socket || !roomCode) return;
    console.debug("[CLIENT][EMIT] canvas_clear", {
      roomCode,
      socketId: socket.id
    });
    socket.emit("canvas_clear", { roomCode });
    setStrokes([]);
    setActiveStrokes(new Map());
  }, [socket, roomCode]);

  const applyFillArea = useCallback((payload: FillAreaBroadcast) => {
    setStrokes((current) => [
      ...current,
      {
        id: payload.fillId,
        color: payload.fillColor,
        size: 0,
        tool: "fill",
        points: [{ x: payload.x, y: payload.y, t: Date.now() }],
        createdAt: Date.now()
      }
    ]);
  }, []);

  const sendFillArea = useCallback(
    ({ x, y, fillColor }: { x: number; y: number; fillColor: string }) => {
      if (!socket || !roomCode) return;
      const fillId = createId("fill");
      localFillIds.current.add(fillId);
      applyFillArea({ fillId, x, y, fillColor });
      socket.emit("fill_area", { roomCode, fillId, x, y, fillColor });
    },
    [socket, roomCode, applyFillArea]
  );

  const sendChat = useCallback(
    (message: string) => {
      if (!socket || !roomCode) return;
      console.debug("[CLIENT][EMIT] chat", {
        roomCode,
        socketId: socket.id,
        message
      });
      socket.emit("chat", { roomCode, message });
    },
    [socket, roomCode]
  );

  const sendGuess = useCallback(
    (message: string) => {
      if (!socket || !roomCode) return;
      console.debug("[CLIENT][EMIT] guess", {
        roomCode,
        socketId: socket.id,
        message
      });
      socket.emit("guess", { roomCode, message });
    },
    [socket, roomCode]
  );

  const selectWord = useCallback(
    (word: string) => {
      if (!socket || !roomCode) return;
      console.debug("[CLIENT][EMIT] select_word", {
        roomCode,
        socketId: socket.id,
        word
      });
      socket.emit("select_word", { roomCode, word });
      setWordOptions([]);
    },
    [socket, roomCode]
  );

  const dismissRoundSummary = useCallback(() => setRoundSummary(null), []);
  const dismissGameOver = useCallback(() => setGameOver(null), []);

  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (payload: ChatMessagePayload) => {
      console.debug("[CLIENT][EVENT] chat_message", payload);
      setChatMessages((current) => [...current, payload].slice(-200));
    };

    const handleGuessResult = (payload: GuessResultPayload) => {
      console.debug("[CLIENT][EVENT] guess_result", payload);
      if (payload.playerId && payload.correct) {
        const playerName = roomRef.current?.players.find(
          (player) => player.id === payload.playerId
        )?.name;
        addNotification(
          playerName ? `${playerName} guessed correctly.` : "A player guessed correctly.",
          "success"
        );
        return;
      }
      if (!payload.playerId) {
        setGuessFeedback(payload);
        if (payload.correct) {
          setHasGuessedCorrectly(true);
        }
      }
    };

    const handlePlayerJoined = (payload: { player: { name: string }; reconnected: boolean }) => {
      const message = payload.reconnected
        ? `${payload.player.name} rejoined the room`
        : `${payload.player.name} joined the room`;
      addNotification(message, "success");
    };

    const handlePlayerLeft = (payload: { playerId: string; reason: string }) => {
      const name = roomRef.current?.players.find(
        (player) => player.id === payload.playerId
      )?.name;
      const message = name ? `${name} left the room` : "A player left the room";
      addNotification(message, "danger");
    };

    const handleDrawStartEvent = (payload: DrawStartBroadcast) => {
      console.log("[DRAW_RECEIVED]", {
        event: "draw_start",
        strokeId: payload.strokeId,
        point: payload.point,
        tool: payload.tool,
        size: payload.size,
        color: payload.color
      });
      console.debug("[CLIENT][EVENT] draw_start", payload);
      if (localStrokeIds.current.has(payload.strokeId)) return;
      applyDrawStart(payload);
    };

    const handleDrawMoveEvent = (payload: DrawMoveBroadcast) => {
      console.log("[DRAW_RECEIVED]", {
        event: "draw_move",
        strokeId: payload.strokeId,
        point: payload.point
      });
      console.debug("[CLIENT][EVENT] draw_move", payload);
      if (localStrokeIds.current.has(payload.strokeId)) return;
      applyDrawMove(payload);
    };

    const handleDrawEndEvent = (payload: DrawEndBroadcast) => {
      console.log("[DRAW_RECEIVED]", {
        event: "draw_end",
        strokeId: payload.strokeId,
        point: payload.point
      });
      console.debug("[CLIENT][EVENT] draw_end", payload);
      if (localStrokeIds.current.has(payload.strokeId)) return;
      applyDrawEnd(payload);
    };

    const handleFillAreaEvent = (payload: FillAreaBroadcast) => {
      if (localFillIds.current.has(payload.fillId)) {
        localFillIds.current.delete(payload.fillId);
        return;
      }
      applyFillArea(payload);
    };

    socket.on("draw_start", handleDrawStartEvent);
    socket.on("draw_move", handleDrawMoveEvent);
    socket.on("draw_end", handleDrawEndEvent);
    socket.on("draw_undo", ({ strokeId }) => {
      console.debug("[CLIENT][EVENT] draw_undo", { strokeId });
      setStrokes((current) => current.filter((stroke) => stroke.id !== strokeId));
    });
    socket.on("canvas_clear", () => {
      console.debug("[CLIENT][EVENT] canvas_clear");
      localStrokeIds.current.clear();
      localFillIds.current.clear();
      setStrokes([]);
      setActiveStrokes(new Map());
    });
    socket.on("draw_data", ({ strokes: nextStrokes }) => {
      console.log("[DRAW_DATA_RECEIVED]", {
        count: nextStrokes.length
      });
      console.debug("[CLIENT][EVENT] draw_data", { count: nextStrokes.length });
      localStrokeIds.current.clear();
      localFillIds.current.clear();
      setStrokes(nextStrokes);
      setActiveStrokes(new Map());
    });
    socket.on("fill_area", handleFillAreaEvent);
    socket.on("chat_message", handleChatMessage);
    socket.on("guess_result", handleGuessResult);
    socket.on("leaderboard_update", ({ leaderboard: nextLeaderboard }) => {
      console.debug("[CLIENT][EVENT] leaderboard_update", {
        count: nextLeaderboard.length
      });
      setLeaderboard(nextLeaderboard);
    });
    socket.on("word_options", ({ options }) => {
      console.debug("[CLIENT][EVENT] word_options", { options });
      setWordOptions(options);
    });
    socket.on("word_selected", () => {
      console.debug("[CLIENT][EVENT] word_selected");
      setWordOptions([]);
    });
    socket.on("round_started", () => {
      console.debug("[CLIENT][EVENT] round_started");
      localStrokeIds.current.clear();
      localFillIds.current.clear();
      setStrokes([]);
      setActiveStrokes(new Map());
      setGuessFeedback(null);
      setHasGuessedCorrectly(false);
      setRoundSummary(null);
      clearNotifications();
    });
    socket.on("round_ended", (payload) => {
      console.debug("[CLIENT][EVENT] round_ended", payload);
      setRoundSummary({
        reason: payload.reason,
        word: payload.word,
        leaderboard: payload.leaderboard
      });
      setLeaderboard(payload.leaderboard);
      setGuessFeedback(null);
      clearNotifications();
    });
    socket.on("game_over", (payload) => {
      console.debug("[CLIENT][EVENT] game_over", payload);
      setGameOver({
        leaderboard: payload.leaderboard,
        winnerId: payload.winnerId
      });
      setLeaderboard(payload.leaderboard);
      setGuessFeedback(null);
      clearNotifications();
    });
    socket.on("game_reset", ({ room }) => {
      console.debug("[CLIENT][EVENT] game_reset", { roomCode: room.roomCode });
      localStrokeIds.current.clear();
      localFillIds.current.clear();
      setStrokes([]);
      setActiveStrokes(new Map());
      setWordOptions([]);
      setLeaderboard([]);
      setRoundSummary(null);
      setGameOver(null);
      setGuessFeedback(null);
      setHasGuessedCorrectly(false);
      clearNotifications();
    });
    socket.on("sync_state", (payload) => {
      setStrokes(payload.strokes);
      setActiveStrokes(new Map());
      setLeaderboard(payload.leaderboard);
      setGuessFeedback(null);
      setHasGuessedCorrectly(false);
    });
    socket.on("game_started", () => {
      clearNotifications();
    });
    socket.on("player_joined", handlePlayerJoined);
    socket.on("player_left", handlePlayerLeft);

    return () => {
      socket.off("draw_start", handleDrawStartEvent);
      socket.off("draw_move", handleDrawMoveEvent);
      socket.off("draw_end", handleDrawEndEvent);
      socket.off("draw_undo");
      socket.off("canvas_clear");
      socket.off("draw_data");
      socket.off("fill_area", handleFillAreaEvent);
      socket.off("chat_message", handleChatMessage);
      socket.off("guess_result", handleGuessResult);
      socket.off("leaderboard_update");
      socket.off("word_options");
      socket.off("word_selected");
      socket.off("round_started");
      socket.off("round_ended");
      socket.off("game_over");
      socket.off("game_reset");
      socket.off("sync_state");
      socket.off("game_started");
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_left", handlePlayerLeft);
      clearNotifications();
    };
  }, [socket, applyDrawStart, applyDrawMove, applyDrawEnd, addNotification, clearNotifications, removeNotification]);

  useEffect(() => {
    if (room) return;
    localStrokeIds.current.clear();
    localFillIds.current.clear();
    setStrokes([]);
    setActiveStrokes(new Map());
    setWordOptions([]);
    setChatMessages([]);
    setLeaderboard([]);
    setRoundSummary(null);
    setGameOver(null);
    setGuessFeedback(null);
    setHasGuessedCorrectly(false);
    clearNotifications();
  }, [room, clearNotifications]);

  const value = useMemo(
    () => ({
      strokes,
      activeStrokes: Array.from(activeStrokes.values()),
      wordOptions,
      chatMessages,
      leaderboard,
      roundSummary,
      gameOver,
      guessFeedback,
      hasGuessedCorrectly,
      notifications,
      sendChat,
      sendGuess,
      sendDrawStart,
      sendDrawMove,
      sendDrawEnd,
      sendUndo,
      sendCanvasClear,
      sendFillArea,
      selectWord,
      dismissRoundSummary,
      dismissGameOver,
      clearNotifications
    }),
    [
      strokes,
      activeStrokes,
      wordOptions,
      chatMessages,
      leaderboard,
      roundSummary,
      gameOver,
      guessFeedback,
      hasGuessedCorrectly,
      notifications,
      sendChat,
      sendGuess,
      sendDrawStart,
      sendDrawMove,
      sendDrawEnd,
      sendUndo,
      sendCanvasClear,
      sendFillArea,
      selectWord,
      dismissRoundSummary,
      dismissGameOver,
      clearNotifications
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGameContext = (): GameContextValue => {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("GameContext is not available");
  }
  return ctx;
};
