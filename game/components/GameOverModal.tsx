"use client";

import { useRef } from "react";
import { ui } from "@/lib/i18n/ui";
import { useFocusTrap } from "@/game/hooks/useFocusTrap";

type GameOverModalProps = {
  score: number;
  rankInfo: { rank: number; nextUsername: string | null } | null;
  saveError: string | null;
  scoreSaving: boolean;
  onPlayAgain: () => void;
  onOpenLeaderboard?: () => void;
  onBack?: () => void;
};

export default function GameOverModal({
  score,
  rankInfo,
  saveError,
  scoreSaving,
  onPlayAgain,
  onOpenLeaderboard,
  onBack,
}: GameOverModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  return (
    <div
      ref={dialogRef}
      className="dead-overlay"
      data-testid="game-over-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
    >
      <div id="game-over-title" className="dead-title">
        {ui.game.gameOver}
      </div>
      <div className="dead-score">
        {ui.game.score}: {score}
      </div>

      {rankInfo && (
        <div className="dead-rank">{ui.game.rankLine(rankInfo.rank, rankInfo.nextUsername)}</div>
      )}

      {scoreSaving && (
        <p className="game-saving" aria-live="polite">
          {ui.game.savingScore}
        </p>
      )}

      {saveError && (
        <p className="alert-error" role="alert">
          {saveError}
        </p>
      )}

      <div className="btn-row">
        <button
          type="button"
          onClick={onPlayAgain}
          className="pbtn pbtn-primary"
          disabled={scoreSaving}
        >
          {ui.game.playAgain}
        </button>
        {onOpenLeaderboard && (
          <button type="button" onClick={onOpenLeaderboard} className="pbtn pbtn-secondary">
            {ui.game.toLeaderboard}
          </button>
        )}
        {onBack && (
          <button type="button" onClick={onBack} className="pbtn pbtn-secondary">
            {ui.common.back}
          </button>
        )}
      </div>
    </div>
  );
}
