import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { ListingCard } from "@/components/listings/ListingCard";
import { RevealList } from "@/components/listings/RevealList";
import { EmptyState } from "@/components/ui/empty-state";
import type { ListingWithSeller } from "@/types";

interface ListingGridProps {
  listings: ListingWithSeller[];
  /** Ids of the listings you saved. Pass it to show a heart on every card; leave it out to show none. */
  savedIds?: string[];
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { href: string; label: string };
}

/** Responsive grid of listing cards, with a shared empty state. */
export function ListingGrid({
  listings,
  savedIds,
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
    <RevealList className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing, index) => (
        // `card-in` (globals.css) fades each card up once, when its <li> first appears (or, for a
        // grid below the first screen, when it scrolls into view: RevealList). React keeps the same
        // <li> on a re-render or refresh (same key), so it does not play again. Only the first eight
        // cards wait (70 ms apart), so a long grid never makes the last cards wait.
        <li key={listing.id} className="card-in" style={{ "--i": Math.min(index, 7) } as CSSProperties}>
          <ListingCard listing={listing} saved={savedIds?.includes(listing.id)} />
        </li>
      ))}
    </RevealList>
  );
}

