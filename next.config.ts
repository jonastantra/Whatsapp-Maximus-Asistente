import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  serverExternalPackages: [
    "baileys",
    "better-sqlite3",
    "pino",
  ],
};

export default nextConfig;
