/**
 * Contract between shell (AuthGate) and the game component.
 *
 * Any game on this template must:
 * 1. Accept these props (extra props may be ignored).
 * 2. Before starting a run, call api.startGameSession() and run deterministically
 *    from the returned seed (see game/engine.ts).
 * 3. Record the input log (format defined by the game) — required for server-side
 *    replay validation.
 * 4. On game over, call api.submitScore(score, sessionId, inputLog).
 *
 * The shell does not know the game name — it renders <Game /> from @/game.
 */
export type ScoreSavedResult = {
  bestScore: number;
  totalScore: number;
};

export type GameComponentProps = {
  /** Nickname for topbar (optional). */
  username?: string;
  /** User's current record (for display). */
  initialBestScore?: number;
  /** Active skin color; ignore if skins are disabled. */
  activeSkinColor?: string;
  /** Called after a server-confirmed score submit. */
  onScoreSaved?: (result: ScoreSavedResult) => void;
  /** Back button in the shell. */
  onBack?: () => void;
  /** Navigate to the leaderboard screen (game over). */
  onOpenLeaderboard?: () => void;
};
