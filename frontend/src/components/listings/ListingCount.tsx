import { getListings } from "@/lib/api";
import type { ListingFilters } from "@/types";

/**
 * "85 listings from students on campus." for one set of filters, in the browse header. It makes
 * the same request as `BrowseResults`, which Next.js runs only once per render.
 */
export async function ListingCount({ filters }: { filters: ListingFilters }) {
  const { length } = await getListings(filters);

  return (
    <p className="text-sm text-muted-foreground">
      {length} {length === 1 ? "listing" : "listings"} from students on campus.
    </p>
  );
}
