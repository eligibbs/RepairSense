import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's native SQLite adapter must execute through Node rather than the
  // Server Component bundle. The client and better-sqlite3 are auto-external.
  serverExternalPackages: ["@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
