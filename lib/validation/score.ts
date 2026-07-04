import { z } from "zod";
import { msg } from "@/lib/i18n/messages";

/** Platform-level score payload. Input semantics are validated by gamePlugin. */
export const scoreBodySchema = z.object({
  score: z
    .number()
    .int("Score must be an integer")
    .min(0, "Score cannot be negative")
    .max(999_999, "Score cannot exceed 999999"),
  sessionId: z.string().regex(/^[0-9a-f]{24}$/i, "Invalid session id"),
  inputLog: z.unknown().optional(),
});

export type ScoreBodyInput = z.infer<typeof scoreBodySchema>;

/** @deprecated Use scoreBodySchema */
export const scoreSchema = scoreBodySchema;

export type ScoreInput = ScoreBodyInput;
