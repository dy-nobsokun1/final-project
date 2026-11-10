import { ListingGrid } from "@/components/listings/ListingGrid";
import { getListings, getSavedListingIds } from "@/lib/api";
import type { ListingWithSeller } from "@/types";

/** How many cards the row shows: one row of the grid on a laptop screen. */
const SHOWN = 4;

/**
 * "Similar items" under a listing: other active items in the same category, newest first (the
 * browse API only lists active ones), never this listing or a wanted post. Hidden when there are
 * none. The page wraps it in Suspense, so it never slows the listing itself; if the API cannot
 * answer, the section is simply left out.
 */
export async function SimilarItems({ listing }: { listing: ListingWithSeller }) {
  const [listings, savedIds] = await Promise.all([
    // A few extra, because this listing and wanted posts are taken out below.
    getListings({ category: listing.category, limit: SHOWN * 3 }).catch((error) => {
      console.error(error);
      return [] as ListingWithSeller[];
    }),
    getSavedListingIds(),
  ]);
  const similar = listings
    .filter((item) => item.id !== listing.id && item.listingType !== "buy_request")
    .slice(0, SHOWN);
  if (similar.length === 0) return null;

  return (
    <section aria-labelledby="similar-items" className="flex flex-col gap-3">
      <h2 id="similar-items" className="font-heading text-xl tracking-tight">Similar items</h2>
      <ListingGrid listings={similar} savedIds={savedIds} />
    </section>
  );
}
