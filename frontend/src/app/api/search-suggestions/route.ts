import type { NextRequest } from "next/server";
import { getListings } from "@/lib/api";
import { formatListingPrice } from "@/lib/utils";
import type { SearchSuggestion } from "@/types";

/** How many listings the navbar search box suggests. */
const SUGGESTION_COUNT = 5;

/**
 * GET /api/search-suggestions?q= -> up to 5 listings for the navbar search box, best match first
 * (the API's normal search, so partial words and typos still match).
 * A Route Handler, not a Server Action: Server Actions run one at a time and cannot be cancelled,
 * and a box that asks while the student types needs both.
 * Only what the dropdown shows goes back, never seller details. Any API error answers [], so the
 * box just shows no suggestions.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json([]);

  try {
    const listings = await getListings({ query: q, limit: SUGGESTION_COUNT });
    const suggestions: SearchSuggestion[] = listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      listingType: listing.listingType,
      priceText: formatListingPrice(listing),
      imageUrl: listing.imageUrls[0] ?? null,
    }));
    return Response.json(suggestions);
  } catch (error) {
    console.error(error);
    return Response.json([]);
  }
}
