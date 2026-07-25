import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "baileys",
    "better-sqlite3",
    "pino",
  ],
};

export default nextConfig;
