import { Megaphone } from "lucide-react";
import Link from "next/link";
import { SaveButton } from "@/components/listings/SaveButton";
import { WantedCardHint } from "@/components/listings/WantedCardHint";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, statusLabel } from "@/lib/constants";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import type { ListingWithSeller } from "@/types";

interface WantedCardProps {
  listing: ListingWithSeller;
  /** Whether you saved it. Leave it out to show no heart, as in ListingCard. */
  saved?: boolean;
}

/**
 * How ListingCard shows a wanted post (`buy_request`): a request for something nobody has listed
 * yet, so there is no photo. A dark card with a dashed border reads as a gap to fill, not an item
 * for sale. The top part keeps the photo's 4:3 shape, so it lines up with the item cards beside it.
 * Text contrast on #31443E: #E6F2DD is 8.9:1 and #B1D3B9 is 6.4:1.
 */
export function WantedCard({ listing, saved }: WantedCardProps) {
  const category = CATEGORIES.find((item) => item.value === listing.category);
  // A wanted post's price is its budget; 0 means any price.
  const budget = listing.price > 0 ? `Up to ${formatPrice(listing.price)}` : "Any budget";

  return (
    // Laid out like ListingCard: the heart sits next to the link, and the lift moves both.
    <div className="relative h-full transition-transform hover:-translate-y-0.5">
      <Link
        href={`/listings/${listing.id}`}
        className="group flex h-full flex-col rounded-xl border-2 border-dashed border-brand-200/70 bg-brand-deep-2 text-brand-50 transition-all hover:border-brand-50 hover:shadow-lg hover:shadow-brand-600/20"
      >
        {/* Where an item card has its photo. It grows if a long title needs more room. */}
        <div className="flex aspect-[4/3] flex-col gap-2 p-3">
          {/* Right padding keeps the label clear of the heart. */}
          <div className="flex flex-wrap items-center gap-2 pr-11">
            <p className="flex items-center gap-1.5 font-heading text-xl leading-none tracking-wide">
              <Megaphone aria-hidden="true" className="size-4" />
              Wanted
            </p>
            {listing.status !== "active" ? <Badge variant="outline">{statusLabel(listing.status)}</Badge> : null}
          </div>
          <h3 className="line-clamp-3 font-semibold leading-snug group-hover:underline sm:text-lg">
            {listing.title}
          </h3>
          <p className="mt-auto font-semibold">{budget}</p>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
          {/* One outlined chip: the category colours in constants.ts were picked for the light cards. */}
          {category ? (
            <span className="w-fit rounded-full border border-brand-200/70 px-2 py-0.5 text-xs">{category.label}</span>
          ) : null}
          <p className="flex items-center gap-1 text-xs text-brand-200">
            {listing.seller.name}
            <VerifiedBadge isVerified={listing.seller.isVerified} />
            <span aria-hidden="true">&middot;</span>
            {formatRelativeTime(listing.createdAt)}
          </p>
          <WantedCardHint posterId={listing.seller.id} />
        </div>
      </Link>
      {saved === undefined ? null : (
        <SaveButton
          listingId={listing.id}
          listingTitle={listing.title}
          sellerId={listing.seller.id}
          saved={saved}
          className="absolute right-2 top-2"
        />
      )}
    </div>
  );
}
