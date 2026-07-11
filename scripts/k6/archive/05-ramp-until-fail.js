import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { firstDeathRun } from "./dino-replay.js";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:3000";
const MAX_VUS = Number(__ENV.MAX_VUS || 100);
const STEP = Number(__ENV.VU_STEP || 10);
const STEP_SEC = Number(__ENV.STEP_SEC || 60);

const serverErrors = new Counter("server_errors");

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

function sessionCookieFrom(res) {
  const cookies = res.cookies["game_session"];
  return cookies?.[0]?.value ?? null;
}

function trackServerError(res) {
  if (!res || res.status === 0 || res.status >= 500) {
    serverErrors.add(1);
    if (res && res.status >= 500) {
      console.warn(`server error status=${res.status} url=${res.url}`);
    }
  }
}

function buildStages() {
  const stages = [{ duration: "20s", target: 0 }];
  for (let vus = STEP; vus <= MAX_VUS; vus += STEP) {
    stages.push({ duration: `${STEP_SEC}s`, target: vus });
  }
  stages.push({ duration: "20s", target: 0 });
  return stages;
}

export const options = {
  setupTimeout: "20m",
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: buildStages(),
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    server_errors: [{ threshold: "count==0", abortOnFail: true, delayAbortEval: "15s" }],
    checks: ["rate>0.95"],
  },
};

export function setup() {
  const users = [];
  const batchSize = 8;
  const pauseSec = 61;
  const runId = Date.now();

  console.log(`setup: seeding up to ${MAX_VUS} users (register limit 10/min)`);

  for (let i = 0; i < MAX_VUS; i++) {
    if (i > 0 && i % batchSize === 0) {
      sleep(pauseSec);
    }
    const username = `k6_ramp_${runId}_${i}`;
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
    trackServerError(res);
    if (res.status === 201) {
      const sessionToken = sessionCookieFrom(res);
      if (sessionToken) {
        users.push({ sessionToken });
      }
    } else {
      console.warn(`setup register i=${i} status=${res.status}`);
    }
  }

  if (users.length < STEP) {
    throw new Error(`setup seeded only ${users.length}/${MAX_VUS} users`);
  }

  console.log(`setup: ready ${users.length} users`);
  return { users };
}

export default function (data) {
  const user = data.users[(__VU - 1) % data.users.length];
  const jar = http.cookieJar();
  jar.set(BASE, "game_session", user.sessionToken);

  const startRes = http.post(`${BASE}/api/game/session/start`, null, {
    headers: jsonHeaders(),
    jar,
    tags: { name: "session_start" },
  });
  trackServerError(startRes);
  check(startRes, { "session start 200": (r) => r.status === 200 });
  if (startRes.status !== 200) {
    return;
  }

  let sessionId;
  let seed;
  try {
    ({ sessionId, seed } = startRes.json());
  } catch {
    return;
  }
  if (!sessionId || !seed) {
    return;
  }

  const run = firstDeathRun(seed);

  sleep(2.5);

  const scoreRes = http.post(
    `${BASE}/api/game/score`,
    JSON.stringify({ score: run.score, sessionId, inputLog: run.jumpTicks }),
    { headers: jsonHeaders(), jar, tags: { name: "score_submit" } },
  );
  trackServerError(scoreRes);
  check(scoreRes, { "score submit 200": (r) => r.status === 200 });

  const lbRes = http.get(`${BASE}/api/leaderboard`, {
    jar,
    tags: { name: "leaderboard" },
  });
  trackServerError(lbRes);
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
