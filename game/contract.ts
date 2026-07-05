/**
 * Контракт между shell (AuthGate) и игровым компонентом.
 *
 * Любая игра на этом шаблоне обязана:
 * 1. Принимать эти props (лишние можно игнорировать).
 * 2. Перед началом партии вызвать api.startGameSession() и вести партию
 *    детерминированно от полученного seed (см. game/engine.ts).
 * 3. Записывать лог ввода (формат задаёт игра) — он нужен серверной
 *    replay-валидации.
 * 4. На game over вызвать api.submitScore(score, sessionId, inputLog).
 *
 * Shell не знает название игры — он рендерит <Game /> из @/game.
 */
export type ScoreSavedResult = {
  bestScore: number;
  totalScore: number;
};

export type GameComponentProps = {
  /** Никнейм для topbar (опционально). */
  username?: string;
  /** Текущий рекорд юзера (для отображения). */
  initialBestScore?: number;
  /** Цвет активного скина; игнорируй, если скины выключены. */
  activeSkinColor?: string;
  /** Вызвать после подтверждённого сервером сабмита счёта. */
  onScoreSaved?: (result: ScoreSavedResult) => void;
  /** Кнопка «Назад» в shell. */
  onBack?: () => void;
  /** Переход на экран рейтинга (game over). */
  onOpenLeaderboard?: () => void;
};
