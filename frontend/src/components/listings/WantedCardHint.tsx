"use client";

import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * "I have this →" on a wanted card, styled like a small button for anyone who has the item. It is
 * text inside the card's link, not a button or link of its own, so the whole card still opens the
 * post. Left out on your own wanted posts (like SaveButton's heart), since you cannot message yourself.
 * Black on #E6F2DD is 18:1.
 */
export function WantedCardHint({ posterId }: { posterId: string }) {
  const { user } = useAuth();
  if (user?.id === posterId) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-ink transition-colors group-hover:bg-white">
      I have this
      <ArrowRight aria-hidden="true" className="size-3.5" />
    </span>
  );
}
