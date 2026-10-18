import { KhqrPayButton } from "@/components/listings/KhqrPayButton";
import { PayButton } from "@/components/listings/PayButton";
import { formatPrice } from "@/lib/utils";
import type { ListingWithSeller } from "@/types";

interface ListingPayButtonsProps {
  listing: ListingWithSeller;
  /** What this buyer pays: the price, their accepted offer, or their winning bid (payableAmount). */
  amount: number;
  /** Which online payments the API has switched on (getPaymentOptions). */
  options: { card: boolean; khqr: boolean };
}

/** The listing page's "Pay with KHQR" and "Pay with card" buttons, for a buyer who may pay online. */
export function ListingPayButtons({ listing, amount, options }: ListingPayButtonsProps) {
  const priceLabel = formatPrice(amount);
  // KHQR also needs the seller to have added a Bakong account, since the money goes straight to them.
  const canPayByKhqr = options.khqr && listing.seller.acceptsKhqr;

  return (
    <>
      {canPayByKhqr ? (
        <KhqrPayButton listingId={listing.id} priceLabel={priceLabel} sellerName={listing.seller.name} />
      ) : null}
      {options.card ? <PayButton listingId={listing.id} priceLabel={priceLabel} /> : null}
    </>
  );
}
