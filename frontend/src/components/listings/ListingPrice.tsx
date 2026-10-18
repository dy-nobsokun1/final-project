import { formatListingPrice, formatPrice } from "@/lib/utils";
import type { ListingWithSeller, Offer } from "@/types";

interface ListingPriceProps {
  listing: ListingWithSeller;
  /** The viewer's latest offer on this listing, or null. */
  myOffer: Offer | null;
}

/**
 * The big price on a listing page. For the buyer an item is reserved for (their offer was
 * accepted), the agreed price, with the asking price struck through.
 */
export function ListingPrice({ listing, myOffer }: ListingPriceProps) {
  if (myOffer?.status === "accepted" && listing.status === "reserved") {
    return (
      <p className="flex flex-wrap items-baseline gap-2 text-3xl font-semibold">
        {formatPrice(myOffer.amount)}{" "}
        <span className="text-base font-normal text-muted-foreground">
          agreed, asking <s>{formatListingPrice(listing)}</s>
        </span>
      </p>
    );
  }
  return <p className="text-3xl font-semibold">{formatListingPrice(listing)}</p>;
}
