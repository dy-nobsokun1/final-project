import { Sparkles } from "lucide-react";
import { ListingCard } from "@/components/listings/ListingCard";
import { WantedDraftCard } from "@/components/marketplace/WantedDraftCard";
import type { AssistantAnswer } from "@/types";

/**
 * One Ask UniSwap answer: its text, the listings it picked as cards (the API only sends listings
 * its searches really found), then the wanted post it drafted, if any.
 */
export function AssistantReply({ answer }: { answer: AssistantAnswer }) {
  return (
    <li className="flex flex-col gap-3">
      <div className="flex max-w-[85%] items-start gap-2">
        <Sparkles aria-hidden="true" className="mt-2.5 size-4 shrink-0" />
        <p className="whitespace-pre-wrap break-words rounded-2xl border border-brand-600/40 bg-brand-50 px-3.5 py-2 text-sm text-foreground">
          {answer.reply}
        </p>
      </div>
      {answer.listings.length > 0 ? (
        // The cards are the chat's own colour, so they sit on the page's dark background, as when browsing.
        <ul className="grid grid-cols-2 gap-3 rounded-xl bg-background p-3 sm:grid-cols-4">
          {answer.listings.map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} />
            </li>
          ))}
        </ul>
      ) : null}
      {answer.wantedDraft ? <WantedDraftCard draft={answer.wantedDraft} /> : null}
    </li>
  );
}
