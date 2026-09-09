"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const toggleTheme = () => {
    const root = document.documentElement;
    const useDark = !root.classList.contains("dark");
    root.classList.toggle("dark", useDark);
    localStorage.setItem("repairsense-theme", useDark ? "dark" : "light");
  };

  return (
    <button
      aria-label="Toggle color theme"
      className="grid size-control place-items-center rounded-md border border-border bg-white text-muted hover:bg-zinc-50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      onClick={toggleTheme}
      title="Toggle color theme"
      type="button"
    >
      <Moon aria-hidden="true" className="size-3.5 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-3.5 dark:block" />
    </button>
  );
}
