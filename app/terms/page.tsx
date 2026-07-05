import Link from "next/link";
import type { Metadata } from "next";
import { gameMeta } from "@/game/meta";
import { ui } from "@/lib/i18n/ui";

export const metadata: Metadata = {
  title: `${ui.legal.terms} — ${gameMeta.displayName}`,
  description: ui.legal.termsSummary,
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <Link href="/" className="back-link">
          {ui.common.back}
        </Link>
        <h1>{ui.legal.termsTitle}</h1>
        <p className="legal-updated">{ui.legal.lastUpdated}</p>

        <section>
          <h2>{ui.legal.termsSections.acceptance.title}</h2>
          <p>{ui.legal.termsSections.acceptance.body}</p>
        </section>

        <section>
          <h2>{ui.legal.termsSections.accounts.title}</h2>
          <p>{ui.legal.termsSections.accounts.body}</p>
        </section>

        <section>
          <h2>{ui.legal.termsSections.conduct.title}</h2>
          <p>{ui.legal.termsSections.conduct.body}</p>
        </section>

        <section>
          <h2>{ui.legal.termsSections.ads.title}</h2>
          <p>{ui.legal.termsSections.ads.body}</p>
        </section>

        <section>
          <h2>{ui.legal.termsSections.liability.title}</h2>
          <p>{ui.legal.termsSections.liability.body}</p>
        </section>
      </div>
    </main>
  );
}
