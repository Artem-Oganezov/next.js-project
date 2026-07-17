import { z } from "zod";

export const reviveBodySchema = z.object({
  sessionId: z.string().regex(/^[0-9a-f]{24}$/i, "Invalid session id"),
  challengeId: z.string().regex(/^[0-9a-f]{24}$/i, "Invalid revive challenge id"),
});

export const reviveChallengeBodySchema = z.object({
  sessionId: z.string().regex(/^[0-9a-f]{24}$/i, "Invalid session id"),
});

export type ReviveBodyInput = z.infer<typeof reviveBodySchema>;
