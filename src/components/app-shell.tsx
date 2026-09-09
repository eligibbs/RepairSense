import { LogOut, Plus, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth, signOut } from "@/auth";
import { Navigation } from "./navigation";
import { ThemeToggle } from "./theme-toggle";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <header className="sticky top-0 z-20 flex h-12 items-center border-b border-border bg-white px-gutter">
        <Link className="flex items-center gap-2 font-semibold tracking-tight" href="/">
          <Image alt="" aria-hidden="true" className="size-7 rounded-md object-contain" height={28} priority src="/logo.png" width={28} />
          RepairSense
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <form action="/search" className="relative hidden md:block">
            <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <label className="sr-only" htmlFor="global-search">Search RepairSense</label>
            <input className="control w-64 pl-8" id="global-search" name="q" placeholder="Search orders, customers…" />
          </form>
          <ThemeToggle />
          {session?.user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="button-ghost" title={`Sign out ${session.user.email ?? ""}`} type="submit">
                <LogOut aria-hidden="true" className="size-3.5" />
                <span className="hidden xl:inline">Sign out</span>
              </button>
            </form>
          ) : null}
          <Link className="button-primary" href="/pickups/new">
            <Plus aria-hidden="true" className="size-3.5" /> New pickup
          </Link>
        </div>
      </header>
      <div className="border-b border-border bg-white px-2 py-1 lg:hidden"><Navigation mobile /></div>
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 lg:grid-cols-[208px_1fr]">
        <aside className="sticky top-12 hidden min-h-[calc(100vh-3rem)] self-start border-r border-border bg-white p-2 lg:block"><Navigation /></aside>
        <main className="min-w-0 p-gutter sm:p-5">{children}</main>
      </div>
    </div>
  );
}
