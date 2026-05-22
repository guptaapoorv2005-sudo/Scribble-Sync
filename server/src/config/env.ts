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
  roundDurationSec: parseNumber(
    process.env.ROUND_DURATION_SEC,
    GAME_DEFAULTS.roundDurationSec,
    30,
    300
  ),
  chooseDurationSec: parseNumber(
    process.env.CHOOSE_DURATION_SEC,
    GAME_DEFAULTS.chooseDurationSec,
    5,
    60
  ),
  hintIntervalSec: parseNumber(
    process.env.HINT_INTERVAL_SEC,
    GAME_DEFAULTS.hintIntervalSec,
    5,
    60
  ),
  roundsPerPlayer: parseNumber(
    process.env.ROUNDS_PER_PLAYER,
    GAME_DEFAULTS.roundsPerPlayer,
    1,
    10
  ),
  maxPlayers: parseNumber(
    process.env.MAX_PLAYERS,
    GAME_DEFAULTS.maxPlayers,
    2,
    20
  ),
  wordOptionsCount: parseNumber(
    process.env.WORD_OPTIONS_COUNT,
    GAME_DEFAULTS.wordOptionsCount,
    2,
    6
  ),
  maxHints: parseNumber(
    process.env.MAX_HINTS,
    GAME_DEFAULTS.maxHints,
    1,
    8
  ),
  disconnectGraceMs: parseNumber(
    process.env.DISCONNECT_GRACE_MS,
    GAME_DEFAULTS.disconnectGraceMs,
    5_000,
    300_000
  )
};
