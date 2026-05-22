import dotenv from "dotenv";
import { GAME_DEFAULTS } from "../constants/game";

dotenv.config();

const parseNumber = (
  value: string | undefined,
  fallback: number,
  min?: number,
  max?: number
): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const boundedMin = min ?? parsed;
  const boundedMax = max ?? parsed;
  return Math.min(Math.max(parsed, boundedMin), boundedMax);
};

const parseStringList = (
  value: string | undefined,
  fallback: string[]
): string[] | "*" => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed === "*") return "*";
  const parts = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseNumber(process.env.PORT, 4000, 1, 65535),
  corsOrigins: parseStringList(process.env.CORS_ORIGIN, ["*"]),
  maxPlayers: parseNumber(
    process.env.MAX_PLAYERS,
    GAME_DEFAULTS.maxPlayers,
    2,
    20
  ),
  rounds: parseNumber(process.env.ROUNDS, GAME_DEFAULTS.rounds, 2, 10),
  drawTime: parseNumber(
    process.env.DRAW_TIME_SEC,
    GAME_DEFAULTS.drawTime,
    15,
    240
  ),
  wordChoices: parseNumber(
    process.env.WORD_CHOICES,
    GAME_DEFAULTS.wordChoices,
    1,
    5
  ),
  hintsEnabled: process.env.HINTS_ENABLED
    ? process.env.HINTS_ENABLED === "true"
    : GAME_DEFAULTS.hintsEnabled,
  hintCount: parseNumber(
    process.env.HINT_COUNT,
    GAME_DEFAULTS.hintCount,
    1,
    10
  ),
  wordMode: (process.env.WORD_MODE as "normal" | "hidden" | "combination" | undefined) ??
    GAME_DEFAULTS.wordMode,
  disconnectGraceMs: parseNumber(
    process.env.DISCONNECT_GRACE_MS,
    GAME_DEFAULTS.disconnectGraceMs,
    5_000,
    300_000
  )
};
