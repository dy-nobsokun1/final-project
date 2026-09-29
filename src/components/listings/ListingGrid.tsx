import type { LucideIcon } from "lucide-react";
import { ListingCard } from "@/components/listings/ListingCard";
import { EmptyState } from "@/components/ui/empty-state";
import type { ListingWithSeller } from "@/types";

interface ListingGridProps {
  listings: ListingWithSeller[];
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { href: string; label: string };
}

/** Responsive grid of listing cards, with a shared empty state. */
export function ListingGrid({
  listings,
  emptyIcon,
  emptyTitle = "No listings found",
  emptyDescription = "Try a different search or filter.",
  emptyAction,
}: ListingGridProps) {
  if (listings.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} />
        </li>
      ))}
    </ul>
  );
}

