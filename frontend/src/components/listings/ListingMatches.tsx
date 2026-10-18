import { ListingGrid } from "@/components/listings/ListingGrid";
import { getListingMatches } from "@/lib/api";
import type { ListingWithSeller } from "@/types";

/**
 * Shown to a listing's owner under an active listing. For a wanted post: items that match it. For
 * anything else: wanted posts the listing could fill, so the owner can message those students.
 * Best match first (backend/src/db/matches.js).
 */
export async function ListingMatches({ listing }: { listing: ListingWithSeller }) {
  if (listing.status !== "active") return null;
  const isWanted = listing.listingType === "buy_request";
  // Matches are extra: if the API cannot answer, the rest of the page still works.
  const matches = await getListingMatches(listing.id).catch((error) => {
    console.error(error);
    return [];
  });
  // A seller only sees this section when someone is looking; a wanted post always shows it.
  if (matches.length === 0 && !isWanted) return null;

  return (
    <section aria-label={isWanted ? "Matching items" : "Matching wanted posts"} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl tracking-tight">
          {isWanted ? "Items that match your request" : "Students looking for something like this"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isWanted
            ? "We email you (and message you on Telegram, if connected) when a new one is posted."
            : "Their wanted posts match your listing. Open one to message them."}
        </p>
      </div>
      {matches.length > 0 ? (
        // No savedIds on purpose: these cards are for finding a match, so they show no hearts.
        <ListingGrid listings={matches} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing matches yet. A short title that names the item, like &quot;TI-84 calculator&quot;, finds the most.
        </p>
      )}
    </section>
  );
}
