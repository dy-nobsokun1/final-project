"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { ListingPhotos } from "@/hooks/use-listing-photos";
import { usePhotoDraft, type PhotoDraftState } from "@/hooks/use-photo-draft";
import type { PriceHint } from "@/lib/fill-listing-form";
import { formatPrice } from "@/lib/utils";

/** "$40–$60 (3 items)", or "$40 (2 items)" when they all cost the same. */
function rangeText({ low, high, count }: PriceHint) {
  const range = low === high ? formatPrice(low) : `${formatPrice(low)}–${formatPrice(high)}`;
  return `${range} (${count} items)`;
}

/** The line under the button after a try: what was filled, the price hint, or what went wrong. */
function resultText(state: PhotoDraftState): string[] {
  if (state.status === "error") return [state.message];
  if (state.status !== "done") return [];
  const lines = [state.filled > 0
    ? "Filled in from your photo. Check it before you post."
    : "Your fields were already filled in, so nothing changed."];
  if (state.hint) {
    const similar = state.hint.sold ? "Similar items sold for" : "Similar items on UniSwap are listed at";
    lines.push(`${similar} ${rangeText(state.hint)}.`);
  }
  if (state.filledPrice !== null) lines.push(`Price set to ${formatPrice(state.filledPrice)}, the middle of that range. Change it if you like.`);
  return lines;
}

/**
 * "Fill in from photo" on a new listing (use-photo-draft.ts). Shows once a photo is picked and the API
 * has a vision model. It only fills empty fields and never posts: the student checks and posts as usual.
 */
export function PhotoDraftButton({ formRef, photos }: { formRef: RefObject<HTMLFormElement | null>; photos: ListingPhotos }) {
  const { canRun, state, run } = usePhotoDraft(formRef, photos);
  if (!canRun) return null;
  const working = state.status === "working";

  return (
    <div className="flex flex-col items-start gap-2">
      {/* Pale with black text, like SaveButton: the outline variant's page-coloured fill is dark on this card. */}
      <Button
        type="button"
        variant="outline"
        onClick={() => void run()}
        disabled={working}
        className="border-border bg-brand-50 text-brand-ink hover:bg-brand-200 hover:text-brand-ink"
      >
        {working ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
        {working ? "Reading your photo..." : "Fill in from photo"}
      </Button>
      <div aria-live="polite" className="text-sm text-muted-foreground">
        {resultText(state).map((line) => <p key={line}>{line}</p>)}
      </div>
    </div>
  );
}
