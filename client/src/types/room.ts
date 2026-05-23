import type { GamePhase } from "./game";

export interface PlayerPublic {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  isConnected: boolean;
  hasGuessedCorrectly: boolean;
}

export interface RoomSettings {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordChoices: number;
  hintsEnabled: boolean;
  hintCount: number;
  
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  rank: number;
}

export interface RoomPublicState {
  roomCode: string;
  name: string;
  isPublic: boolean;
  isPrivate: boolean;
  hostId: string;
  phase: GamePhase;
  roundNumber: number;
  totalRounds: number;
  currentDrawerId: string | null;
  maskedWord: string | null;
  wordLength: number;
  players: PlayerPublic[];
  settings: RoomSettings;
  timeLeftSec: number | null;
}
