import { auth } from "@/auth";
import { isLocalDevelopmentAuthBypassEnabled } from "@/lib/local-development";

export async function requireAuthenticatedUser() {
  if (isLocalDevelopmentAuthBypassEnabled()) return null;
  const session = await auth();
  if (!session?.user) throw new Error("Authentication required.");
  return session.user;
}
