"use client";

import { X } from "lucide-react";
import { useState } from "react";

interface DismissibleTipProps {
  /** Screen-reader name of the X button, e.g. "Hide Telegram tip". */
  hideLabel: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * A tip with an X that hides it for this page view only. Nothing is remembered, so the tip is back
 * the next time the page loads. The server renders the tip, so it is already in the first HTML
 * (no waiting, no pop-in).
 */
export function DismissibleTip({ hideLabel, className, children }: DismissibleTipProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div className={className}>
      {children}
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label={hideLabel}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-brand-ink transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-ink"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
