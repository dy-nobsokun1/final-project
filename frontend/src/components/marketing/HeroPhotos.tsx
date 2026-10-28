import Link from "next/link";
import { ListingImage } from "@/components/listings/ListingImage";
import { getListings } from "@/lib/api";
import { cn, formatListingPrice } from "@/lib/utils";

/** A slight tilt per card, so the three read as a fanned-out pile. */
const TILTS = ["-rotate-6", "rotate-3", "rotate-[8deg]"];

/**
 * The three newest active items with a photo, fanned out on the right of the hero (from `lg` up).
 * Wanted posts are left out: they ask for an item, so a photo of one would look like it is for sale.
 * Always the newest items, whatever the browse filters are: it asks for the unfiltered list, which
 * the API sorts newest first. On the unfiltered page that is the same request as the grid's, and
 * Next.js runs identical GET fetches only once per render, so it costs no extra API call.
 */
export async function HeroPhotos() {
  const newest = (await getListings())
    .filter(
      (listing) =>
        listing.status === "active" && listing.listingType !== "buy_request" && listing.imageUrls.length > 0,
    )
    .slice(0, 3);
  if (newest.length === 0) return null;

  return (
    <ul aria-label="Just listed" className="flex items-center">
      {newest.map((listing, index) => (
        <li key={listing.id} className="-ml-10 first:ml-0 hover:z-10 focus-within:z-10">
          {/* The tilt stays for everyone; only the hover lift and straightening are motion. */}
          <Link
            href={`/listings/${listing.id}`}
            className={cn(
              "light-surface flex w-40 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
              "motion-safe:transition-transform motion-safe:hover:-translate-y-2 motion-safe:hover:rotate-0",
              TILTS[index],
            )}
          >
            {/* The title below names the item, so the photo needs no alt text of its own. */}
            <ListingImage src={listing.imageUrls[0]} alt="" className="aspect-[4/3] w-full" />
            <span className="flex flex-col p-2.5 text-sm">
              <span className="truncate font-medium">{listing.title}</span>
              <span className="font-semibold">{formatListingPrice(listing)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
