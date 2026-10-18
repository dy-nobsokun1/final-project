import { SaveButton } from "@/components/listings/SaveButton";
import { getSavedListingIds } from "@/lib/api";
import { formatListingPrice } from "@/lib/utils";
import type { ListingWithSeller } from "@/types";

/**
 * The listing page's title and price, with the save heart and how many students saved it.
 * It looks up which listings you saved itself, so the listing page stays the same size.
 */
export async function ListingHeading({ listing }: { listing: ListingWithSeller }) {
  const savedIds = await getSavedListingIds();
  const count = listing.saveCount;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
        <SaveButton
          listingId={listing.id}
          listingTitle={listing.title}
          sellerId={listing.seller.id}
          saved={savedIds.includes(listing.id)}
        />
      </div>
      <p className="text-3xl font-semibold">{formatListingPrice(listing)}</p>
      {count > 0 ? (
        <p className="text-sm text-muted-foreground">
          Saved by {count} {count === 1 ? "student" : "students"}
        </p>
      ) : null}
    </>
  );
}
