import { ArrowLeftRight, Gavel, Gift, Search, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ListingType } from "@/types";

/**
 * One look per type, all from the brand ramp. Sale has none: it is the default, and a tag on
 * every card would only be noise. Text contrast: 11.7, 9.9, 13.3 and 18.1 to 1.
 */
const TAGS: Record<Exclude<ListingType, "sale">, { label: string; icon: LucideIcon; colours: string }> = {
  // The light ring keeps the dark pill visible on the dark listing page.
  auction: { label: "Auction", icon: Gavel, colours: "bg-brand-deep text-brand-50 ring-brand-50/30" },
  trade: { label: "Trade", icon: ArrowLeftRight, colours: "bg-brand-400 text-brand-ink" },
  // The one warm colour (the filter dropdowns use it too), so free items are the ones that pop.
  giveaway: { label: "Free", icon: Gift, colours: "bg-brand-danger text-brand-50" },
  buy_request: { label: "Wanted", icon: Search, colours: "bg-brand-50 text-brand-ink" },
};

interface ListingTypeTagProps {
  type: ListingType;
  className?: string;
}

/**
 * Small pill naming a listing's type (Auction, Trade, Free, Wanted), so a grid can be scanned at a
 * glance. Renders nothing for sale. The shadow and thin dark ring keep the light pills visible on
 * white product photos. The label is real text, so it is read out as part of the card's link.
 */
export function ListingTypeTag({ type, className }: ListingTypeTagProps) {
  if (type === "sale") return null;
  const { label, icon: Icon, colours } = TAGS[type];

  return (
    <Badge className={cn("font-semibold shadow-sm ring-1 ring-black/10 [&>svg]:size-3.5!", colours, className)}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
