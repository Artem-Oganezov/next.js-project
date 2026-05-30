import { z } from "zod";

const usernameField = z
  .string()
  .trim()
  .min(3, "Имя пользователя: минимум 3 символа")
  .max(30, "Имя пользователя: максимум 30 символов")
  .regex(/^[a-zA-Z0-9_]+$/, "Имя пользователя: только буквы, цифры и _");

const passwordField = z
  .string()
  .min(8, "Пароль: минимум 8 символов")
  .max(128, "Пароль: слишком длинный");

export const registerSchema = z.object({
  username: usernameField,
  email: z.email("Некорректный email").trim().toLowerCase(),
  password: passwordField,
});

export const loginSchema = z.object({
  username: usernameField,
  password: passwordField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
