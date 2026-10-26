import { Suspense } from "react";
import { BrowseResults } from "@/components/listings/BrowseResults";
import { CategoryShortcuts } from "@/components/listings/CategoryShortcuts";
import { FilterPanel } from "@/components/listings/FilterPanel";
import { ListingCount } from "@/components/listings/ListingCount";
import { ListingGridSkeleton } from "@/components/listings/ListingGridSkeleton";
import { HeroBand } from "@/components/marketing/HeroBand";
import type { ListingCategory, ListingCondition, ListingFilters, ListingType } from "@/types";

/**
 * Browse page. Filters arrive as query params and are applied server-side. The results stream in
 * (`BrowseResults`, `ListingCount`), so the hero, category tiles and filters show at once.
 */
export default async function BrowsePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  // A new key for each filter set makes React show the placeholders again, instead of leaving
  // the old results on screen while the new ones load.
  const resultsKey = JSON.stringify(filters);

  return (
    <div className="flex flex-col gap-6">
      <HeroBand />

      <CategoryShortcuts params={params} active={filters.category ?? "all"} />

      <section id="listings" className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-heading text-2xl tracking-tight">Browse listings</h2>
          <Suspense
            key={resultsKey}
            fallback={<span aria-hidden="true" className="h-5 w-56 animate-pulse rounded bg-brand-deep-2 motion-reduce:animate-none" />}
          >
            <ListingCount filters={filters} />
          </Suspense>
        </header>

        <Suspense fallback={<div className="h-24 rounded-xl border border-border" />}>
          <FilterPanel />
        </Suspense>
      </section>

      <Suspense key={resultsKey} fallback={<ListingGridSkeleton />}>
        <BrowseResults filters={filters} />
      </Suspense>
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

