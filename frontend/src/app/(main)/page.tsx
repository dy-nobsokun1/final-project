import { Suspense } from "react";
import { Package } from "lucide-react";
import { FilterPanel } from "@/components/listings/FilterPanel";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { HeroBand } from "@/components/marketing/HeroBand";
import { getListings, getSavedListingIds } from "@/lib/api";
import type { ListingCategory, ListingCondition, ListingFilters, ListingType } from "@/types";

/** Browse page. Filters arrive as query params and are applied server-side. */
export default async function BrowsePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const [listings, savedIds] = await Promise.all([getListings(filters), getSavedListingIds()]);

  return (
    <div className="flex flex-col gap-6">
      <HeroBand />

      <section id="listings" className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-heading text-2xl tracking-tight">Browse listings</h2>
          <p className="text-sm text-muted-foreground">
            {listings.length} {listings.length === 1 ? "listing" : "listings"} from
            students on campus.
          </p>
        </header>

        <Suspense fallback={<div className="h-24 rounded-xl border border-border" />}>
          <FilterPanel />
        </Suspense>
      </section>

      <ListingGrid
        listings={listings}
        savedIds={savedIds}
        emptyIcon={Package}
        emptyTitle="No listings match those filters"
        emptyDescription="Try clearing a filter, or check back once other students post more items."
      />
    </div>
  );
}


/** Read `searchParams` into `ListingFilters`, ignoring unrecognised values. */
function parseFilters(
  params: Record<string, string | string[] | undefined>,
): ListingFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const category = first(params.category);
  const type = first(params.type);
  const condition = first(params.condition);
  const minPrice = Number(first(params.minPrice));
  const maxPrice = Number(first(params.maxPrice));

  const categories: ListingCategory[] = [
    "textbooks",
    "electronics",
    "furniture",
    "clothing",
    "bikes",
    "other",
  ];
  const conditions: ListingCondition[] = ["new", "like_new", "good", "fair"];
  const listingTypes: ListingType[] = ["sale", "trade", "giveaway", "buy_request", "auction"];

  return {
    query: first(params.q),
    listingType:
      type && listingTypes.includes(type as ListingType) ? (type as ListingType) : "all",
    category:
      category && categories.includes(category as ListingCategory)
        ? (category as ListingCategory)
        : "all",
    condition:
      condition && conditions.includes(condition as ListingCondition)
        ? (condition as ListingCondition)
        : "all",
    minPrice: Number.isFinite(minPrice) && minPrice > 0 ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
  };
}

