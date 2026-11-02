"use client";

import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme } from "@/lib/theme";

/** Flip the class on <html> and remember the choice; no reload. */
function switchTheme() {
  const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // Cookies blocked: the theme still changes for this page.
  }
}

/**
 * Light/dark switch for the navbar. Both icons are rendered and CSS shows the one for the
 * other theme, so the server and browser markup always match and nothing needs React state.
 */
export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={switchTheme}
      aria-label="Toggle dark mode"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-200 hover:text-brand-ink"
    >
      <Moon aria-hidden="true" className="size-5 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-5 dark:block" />
    </button>
  );
}
