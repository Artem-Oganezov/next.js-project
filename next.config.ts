import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Минимальный self-contained билд для Docker (node .next/standalone/server.js).
  output: "standalone",
};

export default nextConfig;
