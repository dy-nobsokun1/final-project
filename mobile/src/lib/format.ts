// Labels and prices, COPIED from frontend/src/lib/constants.ts and frontend/src/lib/utils.ts (12 Nov 2026).
import { API_URL } from "@/lib/api";
import type { Listing, ListingCategory, ListingCondition, ListingStatus, ListingType } from "@/types";

export const CATEGORIES: Array<{ value: ListingCategory; label: string }> = [
  { value: "textbooks", label: "Textbooks" },
  { value: "electronics", label: "Electronics" },
  { value: "furniture", label: "Furniture" },
  { value: "clothing", label: "Clothing" },
  { value: "bikes", label: "Bikes" },
  { value: "other", label: "Other" },
];

const CONDITIONS: Record<ListingCondition, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair" };
const TYPES: Record<ListingType, string> = {
  sale: "For sale",
  trade: "For trade",
  giveaway: "Giveaway",
  buy_request: "Wanted",
  auction: "Auction",
};
const STATUSES: Record<ListingStatus, string> = { active: "Available", reserved: "Reserved", sold: "Sold", traded: "Traded" };

export const CONDITION_OPTIONS = Object.entries(CONDITIONS).map(([value, label]) => ({
  value: value as ListingCondition,
  label,
}));

export const conditionLabel = (value: ListingCondition) => CONDITIONS[value] ?? value;
export const listingTypeLabel = (value: ListingType) => TYPES[value] ?? value;
export const statusLabel = (value: ListingStatus) => STATUSES[value] ?? value;
export const categoryLabel = (value: ListingCategory) =>
  CATEGORIES.find((item) => item.value === value)?.label ?? value;

/** "$12", or "$12.50" when there are cents. */
export function formatPrice(amount: number): string {
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/** The price line on a card: "Free", "Budget: up to $50", the top bid, "Trade" or the price. */
export function formatListingPrice(listing: Pick<Listing, "listingType" | "price" | "auction">): string {
  if (listing.listingType === "giveaway") return "Free";
  if (listing.listingType === "buy_request") {
    return listing.price > 0 ? `Budget: up to ${formatPrice(listing.price)}` : "Budget: any";
  }
  if (listing.auction) return formatPrice(listing.auction.highestBid ?? listing.price);
  if (listing.listingType === "trade" && listing.price === 0) return "Trade";
  return formatPrice(listing.price);
}

/**
 * False for the seed photos that are files of the website ("/listings/calculus-book.jpg"): the app
 * talks only to the API, so it cannot load them. API uploads ("/uploads/...") and full URLs are fine.
 */
export function canShowPhoto(url: string): boolean {
  return !url.startsWith("/") || url.startsWith("/uploads/");
}

/** A photo's full address. Photos uploaded to our own API come back as "/uploads/..." paths. */
export function photoUrl(url: string): string {
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

/** "12 Nov 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** A chat time: "14:05" for today, else "12 Nov" (the phone's own time zone). */
export function formatChatTime(iso: string): string {
  const date = new Date(iso);
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
