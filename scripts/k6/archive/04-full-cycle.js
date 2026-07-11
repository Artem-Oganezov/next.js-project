import http from "k6/http";
import { check, sleep } from "k6";
import { firstDeathRun } from "./dino-replay.js";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:3000";
const VUS = Number(__ENV.VUS || 50);

export const options = {
  setupTimeout: "10m",
  scenarios: {
    full_cycle: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: 1,
      maxDuration: "10m",
    },
  },
  thresholds: {
    checks: ["rate>0.90"],
    http_req_failed: ["rate<0.15"],
  },
};

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

function sessionCookieFrom(res) {
  const cookies = res.cookies["game_session"];
  if (cookies && cookies.length > 0) {
    return cookies[0].value;
  }
  return null;
}

export function setup() {
  const users = [];
  const batchSize = 8;
  const pauseSec = 61;
  const runId = Date.now();

  for (let i = 0; i < VUS; i++) {
    if (i > 0 && i % batchSize === 0) {
      sleep(pauseSec);
    }
    const username = `k6_load_${runId}_${i}`;
    const jar = http.cookieJar();
    const res = http.post(
      `${BASE}/api/auth/register`,
      JSON.stringify({
        username,
        email: `${username}@example.com`,
        password: "password12",
      }),
      { headers: jsonHeaders(), jar },
    );
    if (res.status === 201) {
      const sessionToken = sessionCookieFrom(res);
      if (!sessionToken) {
        console.warn(`setup missing session cookie i=${i}`);
        continue;
      }
      users.push({ username, sessionToken });
    } else {
      console.warn(`setup register failed i=${i} status=${res.status}`);
    }
  }

  if (users.length < VUS) {
    throw new Error(`setup seeded only ${users.length}/${VUS} users`);
  }

  return { users };
}

export default function (data) {
  const user = data.users[__VU - 1];
  if (!user) {
    throw new Error(`missing seeded user for VU ${__VU}`);
  }

  const jar = http.cookieJar();
  jar.set(BASE, "game_session", user.sessionToken);

  // Spread game endpoints to stay under per-IP score/session limits (30/min).
  sleep((__VU - 1) * 2.1);

  const startRes = http.post(`${BASE}/api/game/session/start`, null, {
    headers: jsonHeaders(),
    jar,
    tags: { name: "session_start" },
  });
  check(startRes, { "session start 200": (r) => r.status === 200 });
  const { sessionId, seed } = startRes.json();
  const run = firstDeathRun(seed);

  sleep(2.5);

  const scoreRes = http.post(
    `${BASE}/api/game/score`,
    JSON.stringify({ score: run.score, sessionId, inputLog: run.jumpTicks }),
    { headers: jsonHeaders(), jar, tags: { name: "score_submit" } },
  );
  check(scoreRes, {
    "score submit 200": (r) => r.status === 200,
  });

  const lbRes = http.get(`${BASE}/api/leaderboard`, {
    jar,
    tags: { name: "leaderboard_check" },
  });
  check(lbRes, {
    "leaderboard 200": (r) => r.status === 200,
    "leaderboard array": (r) => {
      try {
        return Array.isArray(r.json("leaderboard"));
      } catch {
        return false;
      }
    },
  });
}
