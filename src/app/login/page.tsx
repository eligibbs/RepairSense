import { LogIn } from "lucide-react";
import Image from "next/image";
import { signIn, WORKSPACE_DOMAIN } from "@/auth";

function safeRedirect(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const candidate = new URL(value);
    const applicationUrl = new URL(process.env.AUTH_URL ?? "https://repairs.standinconsulting.com");
    return candidate.origin === applicationUrl.origin ? `${candidate.pathname}${candidate.search}` : "/";
  } catch {
    return "/";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;

  async function signInWithGoogle(formData: FormData) {
    "use server";
    await signIn("google", { redirectTo: safeRedirect(formData.get("callbackUrl")) });
  }

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-md items-center">
      <section className="panel w-full p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
          <Image alt="" aria-hidden="true" className="size-10 rounded-md object-contain" height={40} src="/logo.png" width={40} />
          <div>
            <h1 className="text-base font-semibold">Sign in to RepairSense</h1>
            <p className="text-xs text-muted">Repair operations for Stand-In Consulting</p>
          </div>
        </div>
        {params.error ? (
          <p className="mb-3 rounded-md border border-red-300 bg-red-50 p-2.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            Sign-in was not accepted. Use an active {WORKSPACE_DOMAIN} Google Workspace account.
          </p>
        ) : null}
        <form action={signInWithGoogle}>
          <input name="callbackUrl" type="hidden" value={params.callbackUrl ?? "/"} />
          <button className="button-primary w-full" type="submit">
            <LogIn aria-hidden="true" className="size-3.5" /> Continue with Google
          </button>
        </form>
        <p className="mt-3 text-center text-2xs text-muted">Access is restricted to @{WORKSPACE_DOMAIN}.</p>
      </section>
    </div>
  );
}
