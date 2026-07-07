export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmConnections } = await import("@/lib/warm-connections");
    await warmConnections();
  }
}
