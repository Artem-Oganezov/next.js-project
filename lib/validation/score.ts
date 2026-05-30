import { z } from "zod";

export const scoreSchema = z.object({
  score: z
    .number()
    .int("Счёт должен быть целым числом")
    .min(0, "Счёт не может быть отрицательным")
    .max(999_999, "Счёт не может превышать 999999"),
});

export type ScoreInput = z.infer<typeof scoreSchema>;
