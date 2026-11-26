// A category drawn as an iOS SF Symbol: on Wanted cards (they have no photo) and the item page.
import { SymbolView, type SFSymbol } from "expo-symbols";

import type { ListingCategory } from "@/types";

const SYMBOLS: Record<ListingCategory, SFSymbol> = {
  textbooks: "book",
  electronics: "laptopcomputer",
  furniture: "chair.lounge",
  clothing: "tshirt",
  bikes: "bicycle",
  other: "shippingbox",
};

export function CategoryIcon({ category, size, color }: { category: ListingCategory; size: number; color: string }) {
  return <SymbolView name={SYMBOLS[category]} size={size} tintColor={color} />;
}
