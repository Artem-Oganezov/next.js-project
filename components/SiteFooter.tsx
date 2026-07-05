import Link from "next/link";
import { gameMeta } from "@/game/meta";
import { ui } from "@/lib/i18n/ui";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-brand">{gameMeta.displayName}</p>
      <nav className="site-footer-nav" aria-label={ui.legal.navLabel}>
        <Link href="/privacy">{ui.legal.privacy}</Link>
        <Link href="/terms">{ui.legal.terms}</Link>
      </nav>
      <p className="site-footer-note">{ui.legal.footerNote}</p>
    </footer>
  );
}
