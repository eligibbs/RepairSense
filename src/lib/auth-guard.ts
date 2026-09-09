import { headers } from "next/headers";
import { auth } from "@/auth";

async function isLocalDevelopmentRequest(): Promise<boolean> {
  if (process.env.NODE_ENV !== "development") return false;
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  return host === "localhost" || host.startsWith("localhost:") || host === "127.0.0.1" || host.startsWith("127.0.0.1:");
}

export async function requireAuthenticatedUser() {
  if (await isLocalDevelopmentRequest()) return null;
  const session = await auth();
  if (!session?.user) throw new Error("Authentication required.");
  return session.user;
}
