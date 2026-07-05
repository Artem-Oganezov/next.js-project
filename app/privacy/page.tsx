import Link from "next/link";
import type { Metadata } from "next";
import { gameMeta } from "@/game/meta";
import { ui } from "@/lib/i18n/ui";

export const metadata: Metadata = {
  title: `${ui.legal.privacy} — ${gameMeta.displayName}`,
  description: ui.legal.privacySummary,
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <Link href="/" className="back-link">
          {ui.common.back}
        </Link>
        <h1>{ui.legal.privacyTitle}</h1>
        <p className="legal-updated">{ui.legal.lastUpdated}</p>

        <section>
          <h2>{ui.legal.privacySections.overview.title}</h2>
          <p>{ui.legal.privacySections.overview.body}</p>
        </section>

        <section>
          <h2>{ui.legal.privacySections.collect.title}</h2>
          <p>{ui.legal.privacySections.collect.body}</p>
        </section>

        <section>
          <h2>{ui.legal.privacySections.use.title}</h2>
          <p>{ui.legal.privacySections.use.body}</p>
        </section>

        <section>
          <h2>{ui.legal.privacySections.contact.title}</h2>
          <p>{ui.legal.privacySections.contact.body}</p>
        </section>
      </div>
    </main>
  );
}
