import AuthGate from "@/components/AuthGate";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#fafafa]">
      <AuthGate />
    </main>
  );
}
