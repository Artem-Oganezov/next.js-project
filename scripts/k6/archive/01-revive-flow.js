import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:3000";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1.0"],
  },
};

function jsonHeaders(extra = {}) {
  return { "Content-Type": "application/json", ...extra };
}

function authAndStartSession() {
  const suffix = `${Date.now()}_${__ITER}`;
  const username = `k6_revive_${suffix}`;
  const jar = http.cookieJar();

  const registerRes = http.post(
    `${BASE}/api/auth/register`,
    JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: "password12",
    }),
    { headers: jsonHeaders(), jar, tags: { name: "register" } },
  );
  if (registerRes.status !== 201) {
    const loginRes = http.post(
      `${BASE}/api/auth/login`,
      JSON.stringify({ username, password: "password12" }),
      { headers: jsonHeaders(), jar, tags: { name: "login_fallback" } },
    );
    check(loginRes, { "auth 200 (register or login)": (r) => r.status === 200 });
  } else {
    check(registerRes, { "register 201": (r) => r.status === 201 });
  }

  const startRes = http.post(`${BASE}/api/game/session/start`, null, {
    headers: jsonHeaders(),
    jar,
    tags: { name: "session_start" },
  });
  check(startRes, { "session start 200": (r) => r.status === 200 });
  const { sessionId } = startRes.json();

  return { jar, sessionId };
}

export default function () {
  const { jar, sessionId } = authAndStartSession();

  const instantRevive = http.post(
    `${BASE}/api/game/revive`,
    JSON.stringify({ sessionId, challengeId: sessionId }),
    { headers: jsonHeaders(), jar, tags: { name: "revive_instant_no_challenge" } },
  );
  check(instantRevive, {
    "instant revive without challenge blocked (403)": (r) => r.status === 403,
  });

  const challengeRes = http.post(
    `${BASE}/api/game/revive/challenge`,
    JSON.stringify({ sessionId }),
    { headers: jsonHeaders(), jar, tags: { name: "revive_challenge" } },
  );
  check(challengeRes, {
    "challenge issued 200": (r) => r.status === 200,
    "challenge has minWaitMs": (r) => {
      try {
        return r.json("minWaitMs") >= 1000;
      } catch {
        return false;
      }
    },
  });

  const tooEarlyRevive = http.post(
    `${BASE}/api/game/revive`,
    JSON.stringify({ sessionId, challengeId: sessionId }),
    { headers: jsonHeaders(), jar, tags: { name: "revive_too_early" } },
  );
  check(tooEarlyRevive, {
    "revive before min wait blocked (403)": (r) => r.status === 403,
  });
  if (tooEarlyRevive.status !== 403) {
    console.log(`too-early revive unexpected: status=${tooEarlyRevive.status} body=${tooEarlyRevive.body}`);
  }

  sleep(1.2);

  const validRevive = http.post(
    `${BASE}/api/game/revive`,
    JSON.stringify({ sessionId, challengeId: sessionId }),
    { headers: jsonHeaders(), jar, tags: { name: "revive_valid" } },
  );
  check(validRevive, {
    "revive after wait succeeds (200)": (r) => r.status === 200,
  });
  if (validRevive.status !== 200) {
    console.log(`valid revive unexpected: status=${validRevive.status} body=${validRevive.body}`);
  }
}
