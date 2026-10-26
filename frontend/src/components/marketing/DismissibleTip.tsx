"use client";

import { X } from "lucide-react";
import { useState } from "react";

interface DismissibleTipProps {
  /** The cookie that remembers the tip was hidden. The server checks it before rendering the tip. */
  cookieName: string;
  /** Screen-reader name of the X button, e.g. "Hide Telegram tip". */
  hideLabel: string;
  className?: string;
  children: React.ReactNode;
}

/** A year, in seconds. */
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * A tip with an X that hides it for good in this browser. The X saves a cookie, and the server
 * leaves the tip out of the page once that cookie is there. So a visible tip is already in the
 * first HTML (no waiting, no pop-in), and a hidden one is never sent at all.
 */
export function DismissibleTip({ cookieName, hideLabel, className, children }: DismissibleTipProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  function hide() {
    setHidden(true);
    // Only a display preference, so a plain cookie the page can set is enough (no server call).
    document.cookie = `${cookieName}=1; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  }

  return (
    <div className={className}>
      {children}
      <button
        type="button"
        onClick={hide}
        aria-label={hideLabel}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-brand-ink transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-ink"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
