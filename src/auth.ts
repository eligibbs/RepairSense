import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const WORKSPACE_DOMAIN = "standinconsulting.com";

function isLocalDevelopmentRequest(url: URL): boolean {
  return process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Local development bypasses sign-in, but Auth.js still needs a signing key
  // while it initializes. Production always requires AUTH_SECRET.
  secret: process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "development" ? "repairsense-local-development-only" : undefined),
  trustHost: true,
  providers: [
    Google({
      authorization: { params: { hd: WORKSPACE_DOMAIN } },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth: session, request }) {
      if (request.nextUrl.pathname === "/login" || isLocalDevelopmentRequest(request.nextUrl)) return true;
      return Boolean(session?.user);
    },
    signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const googleProfile = profile as { email_verified?: boolean; hd?: string } | undefined;
      return googleProfile?.email_verified === true && googleProfile.hd?.toLowerCase() === WORKSPACE_DOMAIN;
    },
  },
});
