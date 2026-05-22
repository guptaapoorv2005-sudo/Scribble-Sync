export type GamePhase =
  | "lobby"
  | "choosing"
  | "drawing"
  | "round_end"
  | "game_over";

export type ToolType =
  | "pen"
  | "brush"
  | "eraser"
  | "line"
  | "rectangle"
  | "circle"
  | "fill";

export interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

export interface Stroke {
  id: string;
  color: string;
  size: number;
  tool: ToolType;
  points: StrokePoint[];
  createdAt: number;
}
