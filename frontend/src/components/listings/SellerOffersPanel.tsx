import { HandCoins } from "lucide-react";
import { OfferRow } from "@/components/listings/OfferRow";
import { getListingOffers } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { ListingWithSeller } from "@/types";

/**
 * The seller's Offers box on their own item for sale: the offer they accepted, and the open ones
 * (highest first) with Accept and Decline. It loads the offers itself, because only the seller needs
 * them, so the listing page stays the same size.
 */
export async function SellerOffersPanel({ listing }: { listing: ListingWithSeller }) {
  const offers = await getListingOffers(listing.id);
  const accepted = offers.find((offer) => offer.status === "accepted");
  const pending = offers.filter((offer) => offer.status === "pending");
  // Nothing to show or answer once the item is off the market and no offer was accepted.
  if (!accepted && pending.length === 0 && listing.status !== "active") return null;

  return (
    <section aria-label="Offers" className="light-surface flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-foreground">
      <h2 className="flex items-center gap-1.5 font-semibold">
        <HandCoins aria-hidden="true" className="size-4" />
        Offers
      </h2>

      {accepted ? (
        <p className="text-sm">
          You accepted {accepted.buyer.name}&apos;s offer of {formatPrice(accepted.amount)}
          {listing.status === "reserved"
            ? ", so the item is reserved for them. Mark it sold once you have handed it over, or make it available again if the deal falls through."
            : "."}
        </p>
      ) : null}

      {pending.length > 0 ? (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {pending.map((offer) => (
              <OfferRow key={offer.id} offer={offer} />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Accepting one reserves the item for that buyer and declines the rest. Marking it reserved or sold
            yourself declines them all.
          </p>
        </>
      ) : !accepted ? (
        <p className="text-sm text-muted-foreground">No offers yet.</p>
      ) : null}
    </section>
  );
}
