import { Armchair, Bike, BookOpen, MonitorSmartphone, Package, Shirt, type LucideIcon } from "lucide-react";
import type { ListingCategory, ListingCondition, ListingStatus, ListingType } from "@/types";

export const APP_NAME = "UniSwap";

/** Primary navigation shown in the navbar and the mobile bottom bar. */
export const NAV_LINKS = [
  { href: "/", label: "Browse" },
  { href: "/assistant", label: "Ask" },
  { href: "/listings/new", label: "Sell" },
  { href: "/my-listings", label: "My Listings" },
  { href: "/saved", label: "Saved" },
  { href: "/messages", label: "Messages" },
] as const;

export const CATEGORIES: Array<{
  value: ListingCategory;
  label: string;
  /** Tailwind-safe class list for the category chip. Each one has to stay
   *  legible and distinct against the #B1D3B9 card it sits on. */
  accent: string;
  /** Drawn large where a wanted post's card would have its photo (WantedCard). */
  icon: LucideIcon;
}> = [
  { value: "textbooks", label: "Textbooks", accent: "bg-brand-50 text-brand-ink", icon: BookOpen },
  { value: "electronics", label: "Electronics", accent: "bg-brand-600 text-brand-ink", icon: MonitorSmartphone },
  { value: "furniture", label: "Furniture", accent: "border border-brand-ink/40 text-brand-ink", icon: Armchair },
  { value: "clothing", label: "Clothing", accent: "bg-brand-900 text-brand-50", icon: Shirt },
  { value: "bikes", label: "Bikes", accent: "bg-brand-400 text-brand-ink", icon: Bike },
  { value: "other", label: "Other", accent: "bg-brand-50 text-brand-ink", icon: Package },
];

export const CONDITIONS: Array<{ value: ListingCondition; label: string }> = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

export const LISTING_TYPES: Array<{ value: ListingType; label: string }> = [
  { value: "sale", label: "For sale" },
  { value: "trade", label: "For trade" },
  { value: "giveaway", label: "Giveaway" },
  { value: "buy_request", label: "Wanted" },
  { value: "auction", label: "Auction" },
];

const STATUS_LABELS: Record<ListingStatus, string> = {
  active: "Available",
  reserved: "Reserved",
  sold: "Sold",
  traded: "Traded",
};

/** Most photos a listing can have; the first is the cover. Matches MAX_PHOTOS in backend/src/utils/validation.js. */
export const MAX_LISTING_PHOTOS = 6;
/**
 * Largest photo the form uploads, in MB. The API accepts 5 MB (MAX_SIZE in backend/src/routes/uploads.js),
 * but each photo goes through a Server Action, and on Vercel a request over 4.5 MB is refused.
 */
export const MAX_PHOTO_MB = 4;
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;

/** Maps a condition value to its human label; falls back to the raw value. */
export function conditionLabel(value: ListingCondition): string {
  return CONDITIONS.find((item) => item.value === value)?.label ?? value;
}

/** Maps a category value to its human label; falls back to the raw value. */
export function categoryLabel(value: ListingCategory): string {
  return CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

/** Maps a listing type to its human label; falls back to the raw value. */
export function listingTypeLabel(value: ListingType): string {
  return LISTING_TYPES.find((item) => item.value === value)?.label ?? value;
}

/** Label of the listing form's price field: an auction's starting bid, or a wanted post's budget. */
export function priceFieldLabel(listingType: string): string {
  if (listingType === "auction") return "Starting bid (USD)";
  if (listingType === "buy_request") return "Budget (USD, 0 for any price)";
  return "Price (USD)";
}

export function statusLabel(value: ListingStatus): string {
  return STATUS_LABELS[value] ?? value;
}

