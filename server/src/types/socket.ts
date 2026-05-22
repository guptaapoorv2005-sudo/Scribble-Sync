import type { GamePhase, Stroke, StrokePoint, ToolType } from "./game";
import type {
  LeaderboardEntry,
  PlayerPublic,
  RoomPublicState,
  RoomSettings
} from "./room";

export interface CreateRoomPayload {
  name: string;
  playerName: string;
  isPublic?: boolean;
  isPrivate?: boolean;
  maxPlayers?: number;
  settings?: Partial<RoomSettings>;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
  playerId?: string;
}

export interface QuickPlayPayload {
  playerName: string;
  roomName?: string;
}

export interface LeaveRoomPayload {
  roomCode: string;
}

export interface StartGamePayload {
  roomCode: string;
}

export interface SelectWordPayload {
  roomCode: string;
  word: string;
}

export interface ChatPayload {
  roomCode: string;
  message: string;
}

export interface GuessPayload {
  roomCode: string;
  message: string;
}

export interface DrawStartPayload {
  roomCode: string;
  strokeId: string;
  point: StrokePoint;
  color: string;
  size: number;
  tool: ToolType;
}

export interface DrawMovePayload {
  roomCode: string;
  strokeId: string;
  point: StrokePoint;
}

export interface DrawEndPayload {
  roomCode: string;
  strokeId: string;
  point: StrokePoint;
}

export interface DrawUndoPayload {
  roomCode: string;
}

export interface CanvasClearPayload {
  roomCode: string;
}

export interface RequestStatePayload {
  roomCode: string;
}

export interface UpdateRoomSettingsPayload {
  roomCode: string;
  settings: RoomSettings;
}

export interface RoomSettingsUpdatedPayload {
  settings: RoomSettings;
}

export interface RoomCreatedPayload {
  room: RoomPublicState;
  playerId: string;
  drawerWord?: string;
}

export interface RoomJoinedPayload {
  room: RoomPublicState;
  playerId: string;
  drawerWord?: string;
}

export interface SyncStatePayload {
  room: RoomPublicState;
  playerId: string;
  leaderboard: LeaderboardEntry[];
  strokes: Stroke[];
  drawerWord?: string;
}

export interface PlayerJoinedPayload {
  player: PlayerPublic;
  reconnected: boolean;
}

export interface PlayerLeftPayload {
  playerId: string;
  reason: "left" | "disconnected" | "timeout" | "kicked";
}

export interface HostChangedPayload {
  hostId: string;
}

export interface GameStartedPayload {
  room: RoomPublicState;
}

export interface RoundStartedPayload {
  roomCode: string;
  roundNumber: number;
  totalRounds: number;
  drawerId: string;
  phase: GamePhase;
  chooseDurationSec: number;
}

export interface WordOptionsPayload {
  options: string[];
  chooseDurationSec: number;
}

export interface WordSelectedPayload {
  maskedWord: string;
  wordLength: number;
  drawerId: string;
  roundDurationSec: number;
  word?: string;
}

export interface TimerTickPayload {
  timeLeftSec: number;
  phase: GamePhase;
}

export interface HintUpdatePayload {
  maskedWord: string;
  revealedCount: number;
}

export interface RoundEndedPayload {
  reason: "time_up" | "all_guessed" | "drawer_left" | "not_enough_players";
  word: string;
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardPayload {
  leaderboard: LeaderboardEntry[];
}

export interface GameOverPayload {
  leaderboard: LeaderboardEntry[];
  winnerId: string | null;
}

export interface GameResetPayload {
  room: RoomPublicState;
}

export interface DrawStartBroadcast {
  strokeId: string;
  point: StrokePoint;
  color: string;
  size: number;
  tool: ToolType;
}

export interface DrawMoveBroadcast {
  strokeId: string;
  point: StrokePoint;
}

export interface DrawEndBroadcast {
  strokeId: string;
  point: StrokePoint;
}

export interface DrawUndoBroadcast {
  strokeId: string;
}

export interface DrawDataBroadcast {
  strokes: Stroke[];
}

export interface FillAreaPayload {
  roomCode: string;
  fillId: string;
  x: number;
  y: number;
  fillColor: string;
}

export interface FillAreaBroadcast {
  fillId: string;
  x: number;
  y: number;
  fillColor: string;
}

export interface ChatMessagePayload {
  id: string;
  playerId: string | null;
  name: string;
  message: string;
  isSystem: boolean;
  type: "chat" | "system";
  variant:
    | "chat"
    | "guess"
    | "join"
    | "leave"
    | "correct_guess"
    | "round";
  createdAt: number;
}

export interface GuessResultPayload {
  playerId?: string;
  correct: boolean;
  pointsAwarded?: number;
  alreadyGuessed?: boolean;
}

export interface SocketErrorPayload {
  message: string;
  code: string;
}

export interface ServerToClientEvents {
  room_created: (payload: RoomCreatedPayload) => void;
  room_joined: (payload: RoomJoinedPayload) => void;
  sync_state: (payload: SyncStatePayload) => void;
  player_joined: (payload: PlayerJoinedPayload) => void;
  player_left: (payload: PlayerLeftPayload) => void;
  host_changed: (payload: HostChangedPayload) => void;
  game_started: (payload: GameStartedPayload) => void;
  round_started: (payload: RoundStartedPayload) => void;
  word_options: (payload: WordOptionsPayload) => void;
  word_selected: (payload: WordSelectedPayload) => void;
  room_settings_updated: (payload: RoomSettingsUpdatedPayload) => void;
  timer_tick: (payload: TimerTickPayload) => void;
  hint_update: (payload: HintUpdatePayload) => void;
  round_ended: (payload: RoundEndedPayload) => void;
  leaderboard_update: (payload: LeaderboardPayload) => void;
  game_over: (payload: GameOverPayload) => void;
  game_reset: (payload: GameResetPayload) => void;
  draw_start: (payload: DrawStartBroadcast) => void;
  draw_move: (payload: DrawMoveBroadcast) => void;
  draw_end: (payload: DrawEndBroadcast) => void;
  draw_undo: (payload: DrawUndoBroadcast) => void;
  canvas_clear: () => void;
  draw_data: (payload: DrawDataBroadcast) => void;
  fill_area: (payload: FillAreaBroadcast) => void;
  chat_message: (payload: ChatMessagePayload) => void;
  guess_result: (payload: GuessResultPayload) => void;
  socket_error: (payload: SocketErrorPayload) => void;
}

export interface ClientToServerEvents {
  create_room: (payload: CreateRoomPayload) => void;
  join_room: (payload: JoinRoomPayload) => void;
  quick_play: (payload: QuickPlayPayload) => void;
  leave_room: (payload: LeaveRoomPayload) => void;
  start_game: (payload: StartGamePayload) => void;
  select_word: (payload: SelectWordPayload) => void;
  chat: (payload: ChatPayload) => void;
  guess: (payload: GuessPayload) => void;
  draw_start: (payload: DrawStartPayload) => void;
  draw_move: (payload: DrawMovePayload) => void;
  draw_end: (payload: DrawEndPayload) => void;
  draw_undo: (payload: DrawUndoPayload) => void;
  canvas_clear: (payload: CanvasClearPayload) => void;
  fill_area: (payload: FillAreaPayload) => void;
  return_to_lobby: (payload: { roomCode: string }) => void;
  request_state: (payload: RequestStatePayload) => void;
  update_room_settings: (payload: UpdateRoomSettingsPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  playerId?: string;
  roomCode?: string;
}
