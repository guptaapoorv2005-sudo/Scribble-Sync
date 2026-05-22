import { randomBytes } from "crypto";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const clampLength = (length: number): number => {
  if (!Number.isFinite(length) || length < 4) return 4;
  if (length > 8) return 8;
  return Math.floor(length);
};

export const generateRoomCode = (length = 5): string => {
  const safeLength = clampLength(length);
  const bytes = randomBytes(safeLength);
  let code = "";

  for (let i = 0; i < safeLength; i += 1) {
    const index = bytes[i] % ROOM_CODE_CHARS.length;
    code += ROOM_CODE_CHARS[index];
  }

  return code;
};
