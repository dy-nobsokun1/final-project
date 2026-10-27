import { HttpError } from "./httpError.js";

/**
 * How much `buyerId` should pay for a listing row (from LISTING_SELECT), or a clear error.
 * Only two things can be paid online: an item for sale, and an auction you won.
 * Trades, giveaways and "wanted" posts are settled in person.
 * An item for sale costs its price while it is available. Once the seller accepts an offer, it is
 * reserved for that buyer (reserved_for): only they can pay, at the offer's price (agreed_price), or
 * at the asking price if the seller has lowered it below that since.
 */
export function amountToPay(listing, buyerId) {
  if (listing.user_id === buyerId) throw new HttpError(400, "You cannot pay for your own listing.");

  if (listing.listing_type === "sale") {
    let amount = Number(listing.price);
    // Reserved by an accepted offer (routes/offers.js): only that buyer can pay, at the offer's price,
    // unless the asking price is now lower.
    if (listing.status === "reserved" && listing.reserved_for) {
      if (listing.reserved_for !== buyerId) throw new HttpError(403, "This item is reserved for another buyer.");
      amount = Math.min(Number(listing.agreed_price), amount);
    } else if (listing.status !== "active") {
      throw new HttpError(400, "This item is no longer available.");
    }
    if (amount <= 0) throw new HttpError(400, "This item has no price to pay.");
    return amount;
  }
  if (listing.listing_type === "auction") {
    if (listing.status !== "reserved" || listing.leading_bidder_id !== buyerId) {
      throw new HttpError(403, "Only the winner can pay, once the auction has ended.");
    }
    return Number(listing.highest_bid);
  }
  throw new HttpError(400, "Only items for sale and won auctions can be paid online.");
}

/**
 * Where Stripe sends the buyer back to: the address they started paying from, so their sign-in
 * cookie (which belongs to that address) still applies. The presenter may pay on localhost:3000
 * while someone else pays through the tunnel. Only the two addresses the API itself would use
 * are accepted; anything else, including a missing value, gets `fallback`, so this can never
 * become an open redirect.
 */
export function checkoutReturnOrigin(requested, allowedOrigins, fallback) {
  return allowedOrigins.includes(requested) ? requested : fallback;
}
