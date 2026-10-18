// `cn` is provided by the `cn` package that shadcn/ui installs and configures.
// The helpers below are application-specific and are not part of shadcn.
import type { Listing, ListingWithSeller, Offer } from "@/types";

export { cn } from "cn";

/** Format a price for display. Whole amounts drop the trailing `.00`. */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/**
 * Price text for a listing: giveaways are free, a wanted post shows its budget, a trade with no
 * price is a straight swap, and an auction shows its highest bid (or the starting bid before anyone has bid).
 */
export function formatListingPrice(listing: Pick<Listing, "listingType" | "price" | "auction">): string {
  if (listing.listingType === "giveaway") return "Free";
  // A wanted post's price is its budget (matching only suggests items within it); 0 means any price.
  if (listing.listingType === "buy_request") return listing.price > 0 ? `Up to ${formatPrice(listing.price)}` : "Any price";
  if (listing.auction) return formatPrice(listing.auction.highestBid ?? listing.price);
  if (listing.listingType === "trade" && listing.price === 0) return "Trade";
  return formatPrice(listing.price);
}

/** How much this viewer can pay online for a listing, or null. Mirrors amountToPay in backend/src/utils/payments.js. */
export function payableAmount(listing: ListingWithSeller, userId: string | null, myOffer: Offer | null): number | null {
  if (userId === null || userId === listing.seller.id) return null;
  if (listing.listingType === "sale") {
    // An accepted offer of yours on a reserved item means it is reserved for you: the API changes
    // listings.reserved_for and the offer together (routes/offers.js).
    if (listing.status === "reserved") return myOffer?.status === "accepted" ? myOffer.amount : null;
    return listing.status === "active" && listing.price > 0 ? listing.price : null;
  }
  if (listing.auction && listing.status === "reserved" && listing.auction.leadingBidderId === userId) {
    return listing.auction.highestBid;
  }
  return null;
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
];

/** Render an ISO timestamp as "3 hours ago". */
export function formatRelativeTime(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(elapsedMs) >= unitMs) {
      return formatter.format(-Math.round(elapsedMs / unitMs), unit);
    }
  }
  return "just now";
}

/** First letters of a name, for the avatar fallback. */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
