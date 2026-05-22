import { GAME_DEFAULTS } from "../constants/game";

const stripTags = (input: string): string => {
  return input.replace(/<[^>]*>/g, "");
};

const normalizeWhitespace = (input: string): string => {
  return input.replace(/\s+/g, " ").trim();
};

export const sanitizeText = (
  input: unknown,
  maxLength = GAME_DEFAULTS.maxMessageLength
): string => {
  if (typeof input !== "string") return "";
  const noTags = stripTags(input);
  const normalized = normalizeWhitespace(noTags);
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).trim();
};

export const sanitizeName = (input: unknown): string => {
  return sanitizeText(input, GAME_DEFAULTS.maxNameLength);
};

export const normalizeGuess = (input: unknown): string => {
  return sanitizeText(input, GAME_DEFAULTS.maxMessageLength).toLowerCase();
};
