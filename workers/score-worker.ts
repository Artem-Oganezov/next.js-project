import { runScoreWorkerLoop } from "@/lib/queue/score-worker";

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

void runScoreWorkerLoop(controller.signal).catch((error) => {
  console.error(
    JSON.stringify({
      level: "error",
      scope: "score-worker",
      message: error instanceof Error ? error.message : "Worker crashed",
    }),
  );
  process.exit(1);
});
