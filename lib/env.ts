import { z } from "zod";

const envSchema = z
  .object({
    MONGODB_URI: z
      .string()
      .min(1, "MONGODB_URI is required")
      .refine(
        (value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
        "MONGODB_URI must be a valid MongoDB connection string",
      ),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    MONGODB_MAX_POOL_SIZE: z.coerce
      .number()
      .int()
      .min(1, "MONGODB_MAX_POOL_SIZE must be at least 1")
      .max(500, "MONGODB_MAX_POOL_SIZE cannot exceed 500")
      .optional()
      .default(100),
    // Option 1 (VPS / Docker): standard Redis over TCP.
    REDIS_URL: z
      .string()
      .refine(
        (value) => value.startsWith("redis://") || value.startsWith("rediss://"),
        "REDIS_URL must start with redis:// or rediss://",
      )
      .optional(),
    // Option 2 (serverless): Upstash REST API.
    UPSTASH_REDIS_REST_URL: z
      .string()
      .refine(
        (value) => value.startsWith("https://"),
        "UPSTASH_REDIS_REST_URL must be a valid Upstash Redis REST URL",
      )
      .optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    // Fail-closed: when Redis is unavailable, rate-limited requests get 429
    // instead of being allowed through. Default false (fail-open; limiter does not break the API).
    RATE_LIMIT_FAIL_CLOSED: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    // Secret for /api/admin/* and optional /api/metrics protection (min 32 characters).
    ADMIN_SECRET: z.string().min(32).optional(),
    APP_URL: z.string().url("APP_URL must be a valid URL").optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().email().optional(),
    // Trust X-Forwarded-For only behind reverse proxy (nginx, Caddy).
    TRUST_PROXY: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    // Async score queue (VPS + score worker). Requires REDIS_URL (TCP), not Upstash-only.
    SCORE_ASYNC: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    // When true, session/start and score require emailVerified (production hardening).
    REQUIRE_EMAIL_VERIFICATION: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  })
  .superRefine((env, ctx) => {
    const hasTcp = Boolean(env.REDIS_URL);
    const hasUpstash = Boolean(
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN,
    );
    if (!hasTcp && !hasUpstash) {
      ctx.addIssue({
        code: "custom",
        message:
          "Redis is required: set REDIS_URL or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    AUTH_SECRET: process.env.AUTH_SECRET,
    MONGODB_MAX_POOL_SIZE: process.env.MONGODB_MAX_POOL_SIZE,
    REDIS_URL: process.env.REDIS_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    RATE_LIMIT_FAIL_CLOSED: process.env.RATE_LIMIT_FAIL_CLOSED,
    ADMIN_SECRET: process.env.ADMIN_SECRET,
    APP_URL: process.env.APP_URL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    TRUST_PROXY: process.env.TRUST_PROXY,
    SCORE_ASYNC: process.env.SCORE_ASYNC,
    REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
