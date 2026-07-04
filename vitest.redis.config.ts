import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/redis.setup.ts"],
    include: ["tests/**/*.redis.test.ts"],
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
