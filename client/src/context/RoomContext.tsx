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
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoundStartedPayload,
  SyncStatePayload,
  WordSelectedPayload
} from "../types/socket";
import type { RoomPublicState, RoomSettings } from "../types/room";
import { useSocketContext } from "./SocketContext";
import { loadSession, saveSession } from "../utils/storage";

interface RoomContextValue {
  room: RoomPublicState | null;
  playerId: string;
  playerName: string;
  drawerWord: string | null;
  socketError: string | null;
  socketErrorCode: string | null;
  suppressReconnect: boolean;
  setPlayerName: (name: string) => void;
  createRoom: (payload: Omit<CreateRoomPayload, "playerName"> & { playerName?: string }) => void;
  joinRoom: (payload: Omit<JoinRoomPayload, "playerName"> & { playerName?: string }) => void;
  quickPlay: (payload?: { roomName?: string }) => void;
  startGame: () => void;
  leaveRoom: (roomCode?: string) => void;
  reconnectToRoom: (roomCode: string) => void;
  returnToLobby: (roomCode?: string) => void;
  clearSocketError: () => void;
  updateRoomSettings: (settings: RoomSettings) => void;
}

const RoomContext = createContext<RoomContextValue | undefined>(undefined);

export const RoomProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocketContext();
  const session = loadSession();

  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [playerId, setPlayerId] = useState(session.playerId ?? "");
  const [playerName, setPlayerNameState] = useState(session.playerName ?? "");
  const [drawerWord, setDrawerWord] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [socketErrorCode, setSocketErrorCode] = useState<string | null>(null);
  const [lastRoomCode, setLastRoomCode] = useState(session.roomCode ?? "");
  const [suppressReconnect, setSuppressReconnect] = useState(false);
  const leavingRef = useRef(false);
  const leavingTimeoutRef = useRef<number | null>(null);
  const suppressReconnectTimeoutRef = useRef<number | null>(null);

  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
    saveSession({ playerName: name });
  }, []);

  const normalizeRoomCode = (code: string): string => code.trim().toUpperCase();

  const applyRoomUpdate = useCallback(
    (updater: (current: RoomPublicState) => RoomPublicState) => {
      setRoom((current) => (current ? updater(current) : current));
    },
    []
  );

  const handleRoomPayload = useCallback(
    (payload: RoomCreatedPayload | RoomJoinedPayload) => {
      console.debug("[CLIENT][EVENT] room_payload", {
        roomCode: payload.room.roomCode,
        playerId: payload.playerId
      });
      setRoom(payload.room);
      setPlayerId(payload.playerId);
      setDrawerWord(payload.drawerWord ?? null);
      setLastRoomCode(payload.room.roomCode);
      saveSession({
        playerId: payload.playerId,
        roomCode: payload.room.roomCode
      });
    },
    []
  );

  const handleSyncState = useCallback(
    (payload: SyncStatePayload) => {
      setRoom(payload.room);
      setPlayerId(payload.playerId);
      setDrawerWord(payload.drawerWord ?? null);
      setLastRoomCode(payload.room.roomCode);
      saveSession({
        playerId: payload.playerId,
        roomCode: payload.room.roomCode
      });
    },
    []
  );

  const handlePlayerJoined = useCallback(
    ({ player, reconnected }: PlayerJoinedPayload) => {
      console.debug("[CLIENT][EVENT] player_joined", { player, reconnected });
      applyRoomUpdate((current) => {
        const existing = current.players.find((entry) => entry.id === player.id);
        const nextPlayers = existing
          ? current.players.map((entry) =>
              entry.id === player.id
                ? {
                    ...entry,
                    ...player,
                    isConnected: reconnected ? true : player.isConnected
                  }
                : entry
            )
          : [...current.players, player];

        return {
          ...current,
          players: nextPlayers
        };
      });
    },
    [applyRoomUpdate]
  );

  const handlePlayerLeft = useCallback(
    ({ playerId: leftId, reason }: PlayerLeftPayload) => {
      console.debug("[CLIENT][EVENT] player_left", { playerId: leftId, reason });
      applyRoomUpdate((current) => {
        const nextPlayers = reason === "disconnected"
          ? current.players.map((player) =>
              player.id === leftId
                ? { ...player, isConnected: false }
                : player
            )
          : current.players.filter((player) => player.id !== leftId);

        return {
          ...current,
          players: nextPlayers
        };
      });
    },
    [applyRoomUpdate]
  );

  const handleRoundStarted = useCallback(
    (payload: RoundStartedPayload) => {
      console.debug("[CLIENT][EVENT] round_started", payload);
      applyRoomUpdate((current) => ({
        ...current,
        phase: payload.phase,
        roundNumber: payload.roundNumber,
        totalRounds: payload.totalRounds,
        currentDrawerId: payload.drawerId,
        maskedWord: null,
        wordLength: 0,
        timeLeftSec: payload.chooseDurationSec,
        players: current.players.map((player) => ({
          ...player,
          hasGuessedCorrectly: false
        }))
      }));
      setDrawerWord(null);
    },
    [applyRoomUpdate]
  );

  const handleWordSelected = useCallback(
    (payload: WordSelectedPayload) => {
      console.debug("[CLIENT][EVENT] word_selected", payload);
      applyRoomUpdate((current) => ({
        ...current,
        phase: "drawing",
        currentDrawerId: payload.drawerId,
        maskedWord: payload.maskedWord,
        wordLength: payload.wordLength,
        timeLeftSec: payload.roundDurationSec
      }));
      if (payload.word) {
        setDrawerWord(payload.word);
      } else {
        setDrawerWord(null);
      }
    },
    [applyRoomUpdate]
  );

  const updateRoomSettings = useCallback(
    (settings: RoomSettings) => {
      if (!socket) return;
      const target = normalizeRoomCode(room?.roomCode || lastRoomCode);
      if (!target) return;
      console.debug("[CLIENT][EMIT] update_room_settings", {
        roomCode: target,
        settings
      });
      socket.emit("update_room_settings", {
        roomCode: target,
        settings
      });
    },
    [socket, room?.roomCode, lastRoomCode]
  );

  const clearSocketError = useCallback(() => {
    setSocketError(null);
    setSocketErrorCode(null);
  }, []);

  const createRoom = useCallback(
    (payload: Omit<CreateRoomPayload, "playerName"> & { playerName?: string }) => {
      if (!socket) return;
      const name = (payload.playerName ?? playerName).trim();
      if (!name) return;
      setPlayerName(name);
      console.debug("[CLIENT][EMIT] create_room", { name, payload });
      socket.emit("create_room", { ...payload, playerName: name });
    },
    [socket, playerName, setPlayerName]
  );

  const joinRoom = useCallback(
    (payload: Omit<JoinRoomPayload, "playerName"> & { playerName?: string }) => {
      if (!socket) return;
      const name = (payload.playerName ?? playerName).trim();
      if (!name) return;
      const roomCode = normalizeRoomCode(payload.roomCode);
      setPlayerName(name);
      console.debug("[CLIENT][EMIT] join_room", { roomCode, playerId, name });
      socket.emit("join_room", {
        ...payload,
        roomCode,
        playerName: name,
        playerId: payload.playerId || playerId || undefined
      });
    },
    [socket, playerName, playerId, setPlayerName]
  );

  const quickPlay = useCallback(
    (payload?: { roomName?: string }) => {
      if (!socket) return;
      const name = playerName.trim();
      if (!name) return;
      console.debug("[CLIENT][EMIT] quick_play", { roomName: payload?.roomName });
      socket.emit("quick_play", {
        playerName: name,
        roomName: payload?.roomName
      });
    },
    [socket, playerName]
  );

  const reconnectToRoom = useCallback(
    (roomCode: string) => {
      if (!socket) return;
      const name = playerName.trim();
      if (!name) return;
      console.debug("[CLIENT][EMIT] reconnect_room", { roomCode, playerId, name });
      socket.emit("join_room", {
        roomCode: normalizeRoomCode(roomCode),
        playerName: name,
        playerId: playerId || undefined
      });
    },
    [socket, playerName, playerId]
  );

  const leaveRoom = useCallback(
    (roomCode?: string) => {
      if (!socket) return;
      const target = normalizeRoomCode(
        roomCode || room?.roomCode || lastRoomCode
      );
      if (!target) return;
      console.debug("[CLIENT][EMIT] leave_room", { roomCode: target });
      socket.emit("leave_room", { roomCode: target });
      leavingRef.current = true;
      if (leavingTimeoutRef.current !== null) {
        window.clearTimeout(leavingTimeoutRef.current);
      }
      leavingTimeoutRef.current = window.setTimeout(() => {
        leavingRef.current = false;
        leavingTimeoutRef.current = null;
      }, 1500);
      setSuppressReconnect(true);
      if (suppressReconnectTimeoutRef.current !== null) {
        window.clearTimeout(suppressReconnectTimeoutRef.current);
      }
      suppressReconnectTimeoutRef.current = window.setTimeout(() => {
        setSuppressReconnect(false);
        suppressReconnectTimeoutRef.current = null;
      }, 1500);
      setRoom(null);
      setDrawerWord(null);
      setLastRoomCode("");
      setSocketError(null);
      saveSession({ roomCode: "" });
    },
    [socket, room?.roomCode, lastRoomCode]
  );

  const startGame = useCallback(() => {
    if (!socket) return;
    const target = normalizeRoomCode(room?.roomCode || lastRoomCode);
    if (!target) return;
    console.debug("[CLIENT][EMIT] start_game", { roomCode: target });
    socket.emit("start_game", { roomCode: target });
  }, [socket, room?.roomCode, lastRoomCode]);

  const returnToLobby = useCallback(
    (roomCode?: string) => {
      if (!socket) return;
      const target = normalizeRoomCode(
        roomCode || room?.roomCode || lastRoomCode
      );
      if (!target) return;
      console.debug("[CLIENT][EMIT] return_to_lobby", { roomCode: target });
      socket.emit("return_to_lobby", { roomCode: target });
    },
    [socket, room?.roomCode, lastRoomCode]
  );

  useEffect(() => {
    if (!socket) return;

    const handleRoomCreated = (payload: RoomCreatedPayload) => {
      handleRoomPayload(payload);
    };

    const handleRoomJoined = (payload: RoomJoinedPayload) => {
      handleRoomPayload(payload);
    };

    socket.on("room_created", handleRoomCreated);
    socket.on("room_joined", handleRoomJoined);
    socket.on("sync_state", handleSyncState);
    socket.on("player_joined", handlePlayerJoined);
    socket.on("player_left", handlePlayerLeft);
    socket.on("host_changed", ({ hostId }) => {
      applyRoomUpdate((current) => ({
        ...current,
        hostId,
        players: current.players.map((player) => ({
          ...player,
          isHost: player.id === hostId
        }))
      }));
    });
    socket.on("game_started", ({ room: nextRoom }) => {
      console.debug("[CLIENT][EVENT] game_started", {
        roomCode: nextRoom.roomCode
      });
      setRoom(nextRoom);
    });
    socket.on("round_started", handleRoundStarted);
    socket.on("word_selected", handleWordSelected);
    socket.on("room_settings_updated", ({ settings }) => {
      applyRoomUpdate((current) => ({
        ...current,
        settings
      }));
    });
    socket.on("guess_result", ({ playerId, correct }) => {
      if (!playerId || !correct) return;
      applyRoomUpdate((current) => ({
        ...current,
        players: current.players.map((player) =>
          player.id === playerId
            ? { ...player, hasGuessedCorrectly: true }
            : player
        )
      }));
    });
    socket.on("timer_tick", ({ timeLeftSec, phase }) => {
      console.debug("[CLIENT][EVENT] timer_tick", { timeLeftSec, phase });
      applyRoomUpdate((current) => ({
        ...current,
        timeLeftSec,
        phase
      }));
    });
    socket.on("hint_update", ({ maskedWord }) => {
      console.debug("[CLIENT][EVENT] hint_update", { maskedWord });
      applyRoomUpdate((current) => ({
        ...current,
        maskedWord
      }));
    });
    socket.on("round_ended", () => {
      console.debug("[CLIENT][EVENT] round_ended");
      applyRoomUpdate((current) => ({
        ...current,
        phase: "round_end",
        timeLeftSec: 0
      }));
    });
    socket.on("game_over", () => {
      console.debug("[CLIENT][EVENT] game_over");
      applyRoomUpdate((current) => ({
        ...current,
        phase: "game_over",
        timeLeftSec: null
      }));
    });
    socket.on("game_reset", ({ room: nextRoom }) => {
      console.debug("[CLIENT][EVENT] game_reset", {
        roomCode: nextRoom.roomCode
      });
      setRoom(nextRoom);
      setDrawerWord(null);
      setLastRoomCode(nextRoom.roomCode);
      saveSession({ roomCode: nextRoom.roomCode });
    });
    socket.on("socket_error", ({ message, code }) => {
      console.debug("[CLIENT][EVENT] socket_error", { message, code });
      if (leavingRef.current && message.toLowerCase().includes("room not found")) {
        leavingRef.current = false;
        return;
      }
      setSocketErrorCode(code);
      setSocketError(code === "NO_PUBLIC_ROOM_AVAILABLE" ? null : message);
      if (message.toLowerCase().includes("room not found")) {
        setRoom(null);
        setDrawerWord(null);
        setLastRoomCode("");
        saveSession({ roomCode: "" });
      }
    });

    return () => {
      socket.off("room_created", handleRoomCreated);
      socket.off("room_joined", handleRoomJoined);
      socket.off("sync_state", handleSyncState);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_left", handlePlayerLeft);
      socket.off("host_changed");
      socket.off("game_started");
      socket.off("round_started", handleRoundStarted);
      socket.off("word_selected", handleWordSelected);
      socket.off("room_settings_updated");
      socket.off("guess_result");
      socket.off("timer_tick");
      socket.off("hint_update");
      socket.off("round_ended");
      socket.off("game_over");
      socket.off("game_reset");
      socket.off("socket_error");
    };
  }, [socket, handleRoomPayload, handlePlayerJoined, handlePlayerLeft, handleRoundStarted, handleWordSelected, applyRoomUpdate]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      if (suppressReconnect) return;
      const path = window.location.pathname;
      const shouldReconnect = path.startsWith("/room/") || path.startsWith("/game/");
      if (!shouldReconnect) return;
      const target = room?.roomCode || lastRoomCode;
      if (!target) return;
      if (!playerName.trim()) return;
      socket.emit("join_room", {
        roomCode: target,
        playerName: playerName.trim(),
        playerId: playerId || undefined
      });
    };

    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket, room?.roomCode, lastRoomCode, playerName, playerId, suppressReconnect]);

  const value = useMemo(
    () => ({
      room,
      playerId,
      playerName,
      drawerWord,
      socketError,
      socketErrorCode,
      suppressReconnect,
      setPlayerName,
      createRoom,
      joinRoom,
      quickPlay,
      startGame,
      leaveRoom,
      reconnectToRoom,
      returnToLobby,
      clearSocketError,
      updateRoomSettings
    }),
    [
      room,
      playerId,
      playerName,
      drawerWord,
      socketError,
      socketErrorCode,
      suppressReconnect,
      setPlayerName,
      createRoom,
      joinRoom,
      quickPlay,
      startGame,
      leaveRoom,
      reconnectToRoom,
      returnToLobby,
      clearSocketError,
      updateRoomSettings
    ]
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};

export const useRoomContext = (): RoomContextValue => {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error("RoomContext is not available");
  }
  return ctx;
};
