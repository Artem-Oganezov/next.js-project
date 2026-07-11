import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:3000";
const LIMIT = Number(__ENV.LEADERBOARD_LIMIT || 60);
const BURST = Number(__ENV.LEADERBOARD_BURST || 75);

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    "checks{check:got 429 after burst}": ["rate==1.0"],
    "checks{check:at least one 200}": ["rate==1.0"],
  },
};

export default function () {
  let okCount = 0;
  let rateLimited = 0;

  for (let i = 0; i < BURST; i++) {
    const res = http.get(`${BASE}/api/leaderboard`, {
      tags: { name: "leaderboard_burst" },
    });
    if (res.status === 200) okCount += 1;
    if (res.status === 429) rateLimited += 1;
  }

  check(null, {
    "at least one 200": () => okCount >= 1,
    "got 429 after burst": () => rateLimited > 0,
    "429 count exceeds over-limit requests": () =>
      rateLimited >= Math.max(1, BURST - LIMIT),
  });

  console.log(
    `leaderboard burst: ok=${okCount} rate_limited=${rateLimited} burst=${BURST} limit=${LIMIT}`,
  );
}
