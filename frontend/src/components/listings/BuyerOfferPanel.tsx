import { HandCoins } from "lucide-react";
import { OfferActionButton } from "@/components/listings/OfferActionButton";
import { OfferForm } from "@/components/listings/OfferForm";
import { formatPrice } from "@/lib/utils";
import type { ListingWithSeller, Offer } from "@/types";

interface BuyerOfferPanelProps {
  listing: ListingWithSeller;
  /** The signed-in buyer's latest offer on this listing, or null. */
  offer: Offer | null;
}

/**
 * "Make an offer" on someone else's item for sale: where your offer stands, and the form to make or
 * change one while the item is available. Hidden when there is nothing to offer on or to report.
 */
export function BuyerOfferPanel({ listing, offer }: BuyerOfferPanelProps) {
  const isOpen = listing.status === "active" && listing.price > 0;
  // A withdrawn offer is the buyer's own doing, so there is no news to show about it.
  const hasNews = offer !== null && offer.status !== "withdrawn";
  if (!isOpen && !hasNews) return null;

  return (
    <section aria-label="Your offer" className="light-surface flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-foreground">
      <h2 className="flex items-center gap-1.5 font-semibold">
        <HandCoins aria-hidden="true" className="size-4" />
        Make an offer
      </h2>
      <p className="text-sm">{statusLine(listing, offer)}</p>
      {isOpen ? (
        <OfferForm
          listingId={listing.id}
          askingPrice={listing.price}
          currentAmount={offer?.status === "pending" ? offer.amount : null}
        />
      ) : null}
      {isOpen && offer?.status === "pending" ? <OfferActionButton offerId={offer.id} step="withdraw" /> : null}
    </section>
  );
}

/** Where the buyer's offer stands, in one line. */
function statusLine(listing: ListingWithSeller, offer: Offer | null): string {
  const seller = listing.seller.name;
  const amount = offer ? formatPrice(offer.amount) : "";
  switch (offer?.status) {
    case "accepted":
      return listing.status === "reserved"
        ? `${seller} accepted your offer of ${amount}. The item is reserved for you: pay online below if available, or message them to meet on campus.`
        : `Your offer of ${amount} was accepted.`;
    case "pending":
      return `You offered ${amount}. Waiting for ${seller} to answer.`;
    case "declined":
      return listing.status === "active"
        ? `Your offer of ${amount} was declined. You can make a new offer.`
        : `Your offer of ${amount} was declined: the item is no longer available.`;
    case "cancelled":
      return `${seller} made the item available again, so your accepted offer of ${amount} no longer reserves it.`;
    default:
      return `Asking ${formatPrice(listing.price)}. Offer less, and if ${seller} accepts, the item is reserved for you at that price.`;
  }
}
