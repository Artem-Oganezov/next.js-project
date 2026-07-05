import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal self-contained build for Docker (node .next/standalone/server.js).
  output: "standalone",
};

export default nextConfig;
