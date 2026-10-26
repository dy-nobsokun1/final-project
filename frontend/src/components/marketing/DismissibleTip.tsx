"use client";

import { X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

interface DismissibleTipProps {
  /** The localStorage key that remembers the tip was hidden. */
  storageKey: string;
  /** Screen-reader name of the X button, e.g. "Hide Telegram tip". */
  hideLabel: string;
  className?: string;
  children: React.ReactNode;
}

/** Whether the tip was hidden before. Storage can be blocked (private mode), so then it was not. */
function wasHidden(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

/** Hiding the tip in another tab hides it here too. */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * A tip with an X that hides it for good in this browser (localStorage). The server cannot read
 * localStorage, so it renders nothing there (`() => true`) and the browser shows the tip once it has
 * checked: someone who hid it never sees it flash back.
 */
export function DismissibleTip({ storageKey, hideLabel, className, children }: DismissibleTipProps) {
  const hiddenBefore = useSyncExternalStore(subscribe, () => wasHidden(storageKey), () => true);
  const [hiddenNow, setHiddenNow] = useState(false);
  if (hiddenBefore || hiddenNow) return null;

  function hide() {
    setHiddenNow(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Storage is blocked: it stays hidden until the page is reloaded.
    }
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
