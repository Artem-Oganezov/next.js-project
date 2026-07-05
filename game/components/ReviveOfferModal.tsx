"use client";

import { useRef, type RefObject } from "react";
import { isReviveAdEnabled } from "@/lib/client/ads";
import { ui } from "@/lib/i18n/ui";
import { useFocusTrap } from "@/game/hooks/useFocusTrap";

const REVIVE_AD_ENABLED = isReviveAdEnabled();

type ReviveOfferModalProps = {
  score: number;
  reviveRank: { rank: number; nextUsername: string | null } | null;
  reviveCountdown: number;
  adLoading: boolean;
  saveError: string | null;
  adSlotRef: RefObject<HTMLDivElement | null>;
  onWatchAd: () => void;
  onSaveScore: () => void;
  onRestart: () => void;
  onOpenLeaderboard?: () => void;
};

export default function ReviveOfferModal({
  score,
  reviveRank,
  reviveCountdown,
  adLoading,
  saveError,
  adSlotRef,
  onWatchAd,
  onSaveScore,
  onRestart,
  onOpenLeaderboard,
}: ReviveOfferModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  return (
    <div
      ref={dialogRef}
      className="dead-overlay revive-modal"
      data-testid="revive-offer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revive-offer-title"
    >
      <div id="revive-offer-title" className="dead-title">
        {ui.game.crashTitle}
      </div>
      <div className="dead-score">
        {ui.game.score}: {score}
      </div>

      {reviveRank && (
        <div className="dead-rank">
          {ui.game.rankLine(reviveRank.rank, reviveRank.nextUsername)}
        </div>
      )}

      {REVIVE_AD_ENABLED && (
        <div className="revive-ad-banner">
          <p className="revive-ad-banner-text">{ui.game.reviveAdBanner}</p>
          <div className="revive-countdown" aria-live="polite">
            {reviveCountdown}
          </div>
        </div>
      )}

      {!REVIVE_AD_ENABLED && (
        <p className="game-sub revive-hint">{ui.game.reviveHintNoAd}</p>
      )}

      <div
        ref={adSlotRef}
        className="revive-ad-slot"
        data-testid="revive-ad-slot"
        aria-hidden={!adLoading}
      />

      {saveError && (
        <p className="alert-error" role="alert">
          {saveError}
        </p>
      )}

      {REVIVE_AD_ENABLED ? (
        <>
          <button
            type="button"
            data-testid="revive-watch-ad-btn"
            onClick={onWatchAd}
            className="pbtn pbtn-primary revive-continue-btn"
            disabled={adLoading}
          >
            {adLoading ? ui.game.adLoading : `▶ ${ui.game.watchAdContinue}`}
          </button>

          <div className="revive-secondary-row">
            <button
              type="button"
              onClick={onRestart}
              className="pbtn pbtn-secondary revive-secondary-btn"
              disabled={adLoading}
            >
              ↻ {ui.game.restartRun}
            </button>
            {onOpenLeaderboard && (
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="pbtn pbtn-secondary revive-secondary-btn"
                disabled={adLoading}
              >
                🏆 {ui.game.toLeaderboard}
              </button>
            )}
          </div>

          <button
            type="button"
            data-testid="revive-save-score-btn"
            onClick={onSaveScore}
            className="revive-save-link"
            disabled={adLoading}
          >
            {ui.game.saveScoreLink}
          </button>
        </>
      ) : (
        <div className="btn-row">
          <button
            type="button"
            data-testid="revive-save-score-btn"
            onClick={onSaveScore}
            className="pbtn pbtn-primary"
            disabled={adLoading}
          >
            {ui.game.saveScore}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="pbtn pbtn-secondary"
            disabled={adLoading}
          >
            ↻ {ui.game.restartRun}
          </button>
          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="pbtn pbtn-secondary"
              disabled={adLoading}
            >
              🏆 {ui.game.toLeaderboard}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
