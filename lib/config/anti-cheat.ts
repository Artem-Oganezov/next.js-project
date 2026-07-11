/** Suspicious score rejects before automatic ban (per user, rolling window). */
export const ANTI_CHEAT_AUTO_BAN_THRESHOLD = Number(
  process.env.ANTI_CHEAT_AUTO_BAN_THRESHOLD ?? 8,
);

export const ANTI_CHEAT_AUTO_BAN_WINDOW_SEC = Number(
  process.env.ANTI_CHEAT_AUTO_BAN_WINDOW_SEC ?? 3600,
);

/** Minimum wait after revive challenge before revive claim (ms). */
export const REVIVE_CHALLENGE_MIN_MS = Number(
  process.env.REVIVE_CHALLENGE_MIN_MS ?? 1000,
);

export const REVIVE_CHALLENGE_TTL_SEC = 300;
