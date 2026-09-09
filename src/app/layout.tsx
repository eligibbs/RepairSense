import type { Metadata } from "next";
import Script from "next/script";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepairSense",
  description: "Repair operations, work orders, customers, and inventory.",
  icons: {
    icon: { url: "/logo.png", type: "image/png" },
    apple: { url: "/logo.png", type: "image/png" },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Script id="theme-script" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("repairsense-theme");var d=t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
