import type { ListingCategory, ListingCondition } from "@/types";

export const APP_NAME = "UniSwap";

/** Primary navigation shown in the navbar and the mobile bottom bar. */
export const NAV_LINKS = [
  { href: "/", label: "Browse" },
  { href: "/listings/new", label: "Sell" },
  { href: "/my-listings", label: "My Listings" },
  { href: "/messages", label: "Messages" },
] as const;

export const CATEGORIES: Array<{
  value: ListingCategory;
  label: string;
  /** Tailwind-safe class list for the category chip. Each one has to stay
   *  legible and distinct against the #B1D3B9 card it sits on. */
  accent: string;
}> = [
  { value: "textbooks", label: "Textbooks", accent: "bg-brand-50 text-brand-ink" },
  { value: "electronics", label: "Electronics", accent: "bg-brand-600 text-brand-ink" },
  { value: "furniture", label: "Furniture", accent: "border border-brand-ink/40 text-brand-ink" },
  { value: "clothing", label: "Clothing", accent: "bg-brand-900 text-brand-50" },
  { value: "bikes", label: "Bikes", accent: "bg-brand-400 text-brand-ink" },
  { value: "other", label: "Other", accent: "bg-brand-50 text-brand-ink" },
];

export const CONDITIONS: Array<{ value: ListingCondition; label: string }> = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

export const PRICE_MIN = 0;
export const PRICE_MAX = 1000;

/** Maps a condition value to its human label; falls back to the raw value. */
export function conditionLabel(value: ListingCondition): string {
  return CONDITIONS.find((item) => item.value === value)?.label ?? value;
}

/** Maps a category value to its human label; falls back to the raw value. */
export function categoryLabel(value: ListingCategory): string {
  return CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

