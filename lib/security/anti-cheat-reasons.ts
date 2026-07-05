/** Stable anti-cheat reason codes stored in Mongo and used for metrics. */
export const AntiCheatReason = {
  UNKNOWN_SESSION: "unknown-session",
  DUPLICATE_SUBMIT: "duplicate-submit",
  DUPLICATE_SUBMIT_RACE: "duplicate-submit-race",
  REVIVE_MISMATCH: "revive-mismatch",
  RUN_TOO_SHORT: "run-too-short",
  SESSION_EXPIRED: "session-expired",
  SCORE_CEILING: "score-ceiling",
  REPLAY_REVIVE_MISMATCH: "replay-revive-mismatch",
  REPLAY_FAILED: "replay-failed",
  REPLAY_SCORE_MISMATCH: "replay-score-mismatch",
} as const;

export type AntiCheatReasonCode =
  (typeof AntiCheatReason)[keyof typeof AntiCheatReason];

/** Maps stored reason codes to Prometheus metric labels. */
export function antiCheatMetricLabel(reason: string): string {
  switch (reason) {
    case AntiCheatReason.SCORE_CEILING:
      return "score-ceiling";
    case AntiCheatReason.REPLAY_SCORE_MISMATCH:
    case AntiCheatReason.REPLAY_FAILED:
    case AntiCheatReason.REPLAY_REVIVE_MISMATCH:
      return "replay";
    case AntiCheatReason.REVIVE_MISMATCH:
      return "revive";
    case AntiCheatReason.DUPLICATE_SUBMIT:
    case AntiCheatReason.DUPLICATE_SUBMIT_RACE:
      return "duplicate";
    case AntiCheatReason.RUN_TOO_SHORT:
    case AntiCheatReason.SESSION_EXPIRED:
      return "timing";
    case AntiCheatReason.UNKNOWN_SESSION:
      return "unknown-session";
    default:
      return "other";
  }
}
