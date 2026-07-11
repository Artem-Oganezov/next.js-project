import { gameMeta } from "@/game/meta";
import { ui } from "@/lib/i18n/ui";

function getSiteUrl(): string {
  return process.env.APP_URL?.trim() || "http://localhost:3000";
}

export default function HomeLanding() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: gameMeta.displayName,
    description: gameMeta.description,
    url: getSiteUrl(),
    applicationCategory: "Game",
    operatingSystem: "Web browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <section className="home-landing" aria-label={ui.seo.landingAriaLabel}>
      <h1 className="home-landing-title">{ui.seo.landingTitle(gameMeta.displayName)}</h1>
      <p className="home-landing-lead">{ui.seo.landingLead}</p>
      <ul className="home-landing-features">
        {ui.seo.landingFeatures.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
