import type { ZodSchema } from "zod";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const validatePayload = <T>(
  schema: ZodSchema<T>,
  payload: unknown
): ValidationResult<T> => {
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  const message = parsed.error.issues
    .map((issue) => issue.message)
    .join("; ");

  return { ok: false, error: message || "Invalid payload" };
};
