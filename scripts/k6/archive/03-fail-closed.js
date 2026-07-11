import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:3000";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1.0"],
  },
};

export default function () {
  const health = http.get(`${BASE}/api/health`);
  check(health, {
    "health reachable or fail-closed 429": (r) =>
      r.status === 200 || r.status === 503 || r.status === 429,
    "redis reported disconnected/degraded or health blocked": (r) => {
      if (r.status === 429) return true;
      try {
        const body = r.json();
        return body.redis === "disconnected" || body.status === "degraded";
      } catch {
        return false;
      }
    },
  });

  const res = http.get(`${BASE}/api/leaderboard`, {
    tags: { name: "leaderboard_fail_closed" },
  });

  check(res, {
    "rate limit fail-closed returns 429 when redis down": (r) => r.status === 429,
    "not silently allowed (200)": (r) => r.status !== 200,
  });

  console.log(`fail-closed probe status=${res.status} body=${res.body}`);
}
