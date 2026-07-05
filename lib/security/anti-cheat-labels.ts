import { AntiCheatReason } from "@/lib/security/anti-cheat-reasons";

const LABELS: Record<string, string> = {
  [AntiCheatReason.UNKNOWN_SESSION]: "Unknown or invalid game session",
  [AntiCheatReason.DUPLICATE_SUBMIT]: "Duplicate score submit",
  [AntiCheatReason.DUPLICATE_SUBMIT_RACE]: "Duplicate submit (race)",
  [AntiCheatReason.REVIVE_MISMATCH]: "Revive data mismatch",
  [AntiCheatReason.RUN_TOO_SHORT]: "Run shorter than minimum",
  [AntiCheatReason.SESSION_EXPIRED]: "Session expired",
  [AntiCheatReason.SCORE_CEILING]: "Score too high for elapsed time",
  [AntiCheatReason.REPLAY_REVIVE_MISMATCH]: "Revive tick replay mismatch",
  [AntiCheatReason.REPLAY_FAILED]: "Server replay failed",
  [AntiCheatReason.REPLAY_SCORE_MISMATCH]: "Score does not match replay",
};

export function formatAntiCheatReason(code: string): string {
  return LABELS[code] ?? code;
}
