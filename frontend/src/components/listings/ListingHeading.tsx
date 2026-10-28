import { ListingPrice } from "@/components/listings/ListingPrice";
import { SaveButton } from "@/components/listings/SaveButton";
import { getSavedListingIds } from "@/lib/api";
import type { ListingWithSeller, Offer } from "@/types";

interface ListingHeadingProps {
  listing: ListingWithSeller;
  /** The viewer's latest offer on this listing: an accepted one shows the agreed price. */
  myOffer: Offer | null;
}

/**
 * The listing page's title and price (the agreed price for the buyer whose offer was accepted), with
 * the save heart and how many students saved it.
 * It looks up which listings you saved itself, so the listing page stays the same size.
 */
export async function ListingHeading({ listing, myOffer }: ListingHeadingProps) {
  const savedIds = await getSavedListingIds();
  const count = listing.saveCount;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-heading text-3xl tracking-tight">{listing.title}</h1>
        <SaveButton
          listingId={listing.id}
          listingTitle={listing.title}
          sellerId={listing.seller.id}
          saved={savedIds.includes(listing.id)}
        />
      </div>
      <ListingPrice listing={listing} myOffer={myOffer} />
      {count > 0 ? (
        <p className="text-sm text-muted-foreground">
          Saved by {count} {count === 1 ? "student" : "students"}
        </p>
      ) : null}
    </>
  );
}
