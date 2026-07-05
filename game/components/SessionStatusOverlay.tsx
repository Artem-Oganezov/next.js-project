"use client";

import { ui } from "@/lib/i18n/ui";

type SessionStatusOverlayProps = {
  sessionLoading: boolean;
  sessionFailed: boolean;
  saveError: string | null;
  onRetry: () => void;
  onBack?: () => void;
};

export default function SessionStatusOverlay({
  sessionLoading,
  sessionFailed,
  saveError,
  onRetry,
  onBack,
}: SessionStatusOverlayProps) {
  return (
    <div className="dead-overlay" data-testid="session-status-overlay" role="status">
      {sessionLoading && <p className="game-sub">{ui.game.sessionLoading}</p>}
      {sessionFailed && (
        <>
          <p className="alert-error" role="alert">
            {saveError ?? ui.game.sessionStartFailed}
          </p>
          <button
            type="button"
            className="pbtn pbtn-primary"
            data-testid="session-retry-btn"
            onClick={onRetry}
          >
            {ui.game.sessionRetry}
          </button>
          {onBack && (
            <button type="button" className="pbtn pbtn-secondary mt-2" onClick={onBack}>
              {ui.common.back}
            </button>
          )}
        </>
      )}
    </div>
  );
}
