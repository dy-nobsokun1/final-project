import { Package } from "lucide-react";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { getListings, getSavedListingIds } from "@/lib/api";
import type { ListingFilters } from "@/types";

/**
 * The browse grid for one set of filters. An async component of its own, so the browse page can
 * show the hero, category tiles and filters at once and stream this in behind
 * `ListingGridSkeleton`.
 */
export async function BrowseResults({ filters }: { filters: ListingFilters }) {
  const [listings, savedIds] = await Promise.all([getListings(filters), getSavedListingIds()]);

  return (
    <ListingGrid
      listings={listings}
      savedIds={savedIds}
      emptyIcon={Package}
      emptyTitle="No listings match those filters"
      emptyDescription="Try clearing a filter, or check back once other students post more items."
    />
  );
}
