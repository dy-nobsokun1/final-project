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
  /** Tailwind-safe hue token used for the category chip. */
  accent: string;
}> = [
  { value: "textbooks", label: "Textbooks", accent: "bg-amber-100 text-amber-900" },
  { value: "electronics", label: "Electronics", accent: "bg-sky-100 text-sky-900" },
  { value: "furniture", label: "Furniture", accent: "bg-emerald-100 text-emerald-900" },
  { value: "clothing", label: "Clothing", accent: "bg-rose-100 text-rose-900" },
  { value: "bikes", label: "Bikes", accent: "bg-violet-100 text-violet-900" },
  { value: "other", label: "Other", accent: "bg-zinc-100 text-zinc-900" },
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

