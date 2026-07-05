import AuthGate from "@/components/AuthGate";
import SiteFooter from "@/components/SiteFooter";

export default function Home() {
  return (
    <main className="app-shell">
      <AuthGate />
      <SiteFooter />
    </main>
  );
}
