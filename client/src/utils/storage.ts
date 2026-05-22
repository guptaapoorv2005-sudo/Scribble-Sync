export interface StoredSession {
  playerName: string;
  playerId: string;
  roomCode: string;
}

const KEYS = {
  playerName: "scribble_sync_player_name",
  playerId: "scribble_sync_player_id",
  roomCode: "scribble_sync_room_code"
};

export const loadSession = (): Partial<StoredSession> => {
  if (typeof window === "undefined") return {};
  return {
    playerName: localStorage.getItem(KEYS.playerName) ?? "",
    playerId: localStorage.getItem(KEYS.playerId) ?? "",
    roomCode: localStorage.getItem(KEYS.roomCode) ?? ""
  };
};

export const saveSession = (session: Partial<StoredSession>): void => {
  if (typeof window === "undefined") return;
  if (session.playerName !== undefined) {
    localStorage.setItem(KEYS.playerName, session.playerName);
  }
  if (session.playerId !== undefined) {
    localStorage.setItem(KEYS.playerId, session.playerId);
  }
  if (session.roomCode !== undefined) {
    localStorage.setItem(KEYS.roomCode, session.roomCode);
  }
};

export const clearSession = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.playerName);
  localStorage.removeItem(KEYS.playerId);
  localStorage.removeItem(KEYS.roomCode);
};
