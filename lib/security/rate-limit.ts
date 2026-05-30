import { connectDB } from "@/lib/db/mongoose";
import { RateLimit } from "@/lib/models/RateLimit";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export async function enforceRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  await connectDB();

  const now = Date.now();
  const existing = await RateLimit.findOne({ key });

  if (!existing || existing.expiresAt.getTime() <= now) {
    await RateLimit.findOneAndUpdate(
      { key },
      {
        $set: {
          hits: 1,
          expiresAt: new Date(now + windowMs),
        },
      },
      { upsert: true },
    );
    return { ok: true };
  }

  if (existing.hits >= maxRequests) {
    return {
      ok: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((existing.expiresAt.getTime() - now) / 1000),
      ),
    };
  }

  await RateLimit.updateOne({ key }, { $inc: { hits: 1 } });
  return { ok: true };
}
