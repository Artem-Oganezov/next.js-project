import { loadEnvLocal } from "@/lib/env-local";
import { runScoreWorkerLoop } from "@/lib/queue/score-worker";

loadEnvLocal();

const controller = new AbortController();

process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());

console.log(
  JSON.stringify({
    level: "info",
    scope: "score-worker",
    message: "Score worker started",
  }),
);

void (async () => {
  const { getRedis, resetRedisCache } = await import("@/lib/redis");
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      resetRedisCache();
      await getRedis().ping();
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  await runScoreWorkerLoop(controller.signal);
})().catch((error) => {
  console.error(
    JSON.stringify({
      level: "error",
      scope: "score-worker",
      message: error instanceof Error ? error.message : "Worker crashed",
    }),
  );
  process.exit(1);
});
