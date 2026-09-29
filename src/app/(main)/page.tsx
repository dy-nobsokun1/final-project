import { Suspense } from "react";
import { Package } from "lucide-react";
import { FilterPanel } from "@/components/listings/FilterPanel";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { getListings } from "@/lib/api";
import type { ListingCategory, ListingCondition, ListingFilters } from "@/types";

/** Browse page. Filters arrive as query params and are applied server-side. */
export default async function BrowsePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const listings = await getListings(filters);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Browse listings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {listings.length} {listings.length === 1 ? "listing" : "listings"} from students
          on campus.
        </p>
      </header>

      <Suspense fallback={<div className="h-24 rounded-xl border border-zinc-200" />}>
        <FilterPanel />
      </Suspense>

      <ListingGrid
        listings={listings}
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
  const condition = first(params.condition);
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

  return {
    query: first(params.q),
    category:
      category && categories.includes(category as ListingCategory)
        ? (category as ListingCategory)
        : "all",
    condition:
      condition && conditions.includes(condition as ListingCondition)
        ? (condition as ListingCondition)
        : "all",
    maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
  };
}

