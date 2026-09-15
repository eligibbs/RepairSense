import type { NextConfig } from "next";

const allowedDevOrigins = [
  "10.100.102.171",
  ...(process.env.LOCAL_DEV_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean),
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  // Prisma's native SQLite adapter must execute through Node rather than the
  // Server Component bundle. The client and better-sqlite3 are auto-external.
  serverExternalPackages: ["@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
