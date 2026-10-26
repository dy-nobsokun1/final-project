"use client";

import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * The last line of a wanted card, asking anyone who has the item to reply. It is text inside the
 * card's link, not a link of its own. Left out on your own wanted posts (like SaveButton's heart),
 * since you cannot message yourself.
 */
export function WantedCardHint({ posterId }: { posterId: string }) {
  const { user } = useAuth();
  if (user?.id === posterId) return null;

  return (
    <p className="mt-auto flex items-center gap-1 pt-1 text-sm font-semibold">
      Have one? Message them
      <ArrowRight aria-hidden="true" className="size-4" />
    </p>
  );
}
