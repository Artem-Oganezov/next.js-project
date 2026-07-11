"use client";

import { ui } from "@/lib/i18n/ui";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  return (
    <main className="app screen-content">
      <h2 className="game-title">{ui.common.error}</h2>
      <p className="status-muted text-center" role="alert">
        {error.message || ui.common.error}
      </p>
      <button type="button" className="start-btn mt-4" onClick={() => reset()}>
        {ui.common.retry}
      </button>
    </main>
  );
}
