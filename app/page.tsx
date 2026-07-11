import type { Metadata } from "next";
import AuthGate from "@/components/AuthGate";
import HomeLanding from "@/components/HomeLanding";
import SiteFooter from "@/components/SiteFooter";
import { gameMeta } from "@/game/meta";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  title: `${gameMeta.displayName} — online game with leaderboards`,
};

export default function Home() {
  return (
    <main className="app-shell">
      <HomeLanding />
      <AuthGate />
      <SiteFooter />
    </main>
  );
}
