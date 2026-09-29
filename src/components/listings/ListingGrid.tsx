import type { LucideIcon } from "lucide-react";
import { Effect } from "@/components/animate-ui/primitives/effects/effect";
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
      {listings.map((listing, index) => (
        // No `asChild` here on purpose. Routing the <li> through the registry's
        // `Slot` merged motion's ref onto it, and because `mergeRefs` returns a
        // fresh callback every render the client could not reconcile the
        // server-rendered <li> -- it inserted a second one and threw a hydration
        // mismatch. Animating an inner element instead keeps the <li> static
        // server markup that can never mismatch, and the extra motion.div sits
        // *inside* the <li> so the grid rows are unaffected.
        // `inView` animates cards as they scroll in, `inViewOnce` keeps them
        // from replaying on every scroll. The stagger is capped at eight cards
        // so a long grid (e.g. a busy profile) does not leave the last row
        // waiting on a multi-second delay.
        <li key={listing.id}>
          <Effect
            slide={{ direction: "up", offset: 32 }}
            fade
            blur={{ initialBlur: 6 }}
            delay={Math.min(index, 8) * 60}
            inView
            inViewOnce
            className="h-full"
          >
            <ListingCard listing={listing} />
          </Effect>
        </li>
      ))}
    </ul>
  );
}

