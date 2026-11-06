import { Clock, Heart, MapPin, Package, Sparkles, type LucideIcon } from "lucide-react";
import { CATEGORIES, conditionLabel } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";
import type { ListingWithSeller } from "@/types";

interface Fact {
  icon: LucideIcon;
  label: string;
  value: string;
}

/**
 * The listing page's key facts in a small grid: condition, category (with its own icon), when it
 * was posted, how many students saved it (hidden at 0) and where to pick it up. On the lighter
 * `bg-inset` panel, so it stands apart from the cards around it; `light-surface` gives it dark text.
 */
export function ListingFacts({ listing }: { listing: ListingWithSeller }) {
  const category = CATEGORIES.find((item) => item.value === listing.category);
  const saves = listing.saveCount;
  const facts: Fact[] = [
    { icon: Sparkles, label: "Condition", value: conditionLabel(listing.condition) },
    { icon: category?.icon ?? Package, label: "Category", value: category?.label ?? listing.category },
    { icon: Clock, label: "Posted", value: formatRelativeTime(listing.createdAt) },
    { icon: MapPin, label: "Pickup", value: "On campus (AUPP)" },
  ];
  if (saves > 0) {
    facts.push({ icon: Heart, label: "Saved by", value: `${saves} ${saves === 1 ? "student" : "students"}` });
  }

  return (
    <dl className="light-surface grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl border border-border bg-inset p-4 text-foreground xl:grid-cols-3">
      {facts.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
