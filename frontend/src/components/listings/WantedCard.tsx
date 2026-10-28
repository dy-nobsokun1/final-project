import { Package } from "lucide-react";
import Link from "next/link";
import { ListingTypeTag } from "@/components/listings/ListingTypeTag";
import { SaveButton } from "@/components/listings/SaveButton";
import { WantedCardHint } from "@/components/listings/WantedCardHint";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, statusLabel } from "@/lib/constants";
import { formatListingPrice, formatRelativeTime } from "@/lib/utils";
import type { ListingWithSeller } from "@/types";

interface WantedCardProps {
  listing: ListingWithSeller;
  /** Whether you saved it. Leave it out to show no heart, as in ListingCard. */
  saved?: boolean;
}

/**
 * How ListingCard shows a wanted post (`buy_request`): a request for something nobody has listed
 * yet, so there is no photo. A dark card with a dashed border reads as a gap to fill, and the photo
 * area shows a large icon for the category instead, keeping the 4:3 shape so the card lines up
 * with the item cards beside it. Text contrast on #31443E: #E6F2DD is 8.9:1 and #B1D3B9 is 6.4:1.
 */
export function WantedCard({ listing, saved }: WantedCardProps) {
  const category = CATEGORIES.find((item) => item.value === listing.category);
  const CategoryIcon = category?.icon ?? Package;

  return (
    // Laid out like ListingCard: the heart sits next to the link, and the lift moves both.
    <div className="relative h-full transition-transform hover:-translate-y-0.5">
      <Link
        href={`/listings/${listing.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border-2 border-dashed border-brand-200/70 bg-brand-deep-2 text-brand-50 transition-all hover:border-brand-50 hover:shadow-lg hover:shadow-brand-600/20"
      >
        {/* Where an item card has its photo, with the status and type tags in the same corners. */}
        <div className="relative flex aspect-[4/3] items-center justify-center bg-brand-600/25">
          <CategoryIcon aria-hidden="true" strokeWidth={1.25} className="size-20 text-brand-200" />
          {listing.status !== "active" ? (
            <Badge variant="outline" className="absolute left-2 top-2">{statusLabel(listing.status)}</Badge>
          ) : null}
          <ListingTypeTag type="buy_request" className="absolute bottom-2 left-2 uppercase tracking-wide" />
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:underline">{listing.title}</h3>
          <p className="font-semibold">{formatListingPrice(listing)}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
            {/* One outlined chip: the category colours in constants.ts were picked for the light cards. */}
            {category ? (
              <span className="rounded-full border border-brand-200/70 px-2 py-0.5 text-xs">{category.label}</span>
            ) : null}
            <WantedCardHint posterId={listing.seller.id} />
          </div>
          <p className="flex items-center gap-1 text-xs text-brand-200">
            {listing.seller.name}
            <VerifiedBadge isVerified={listing.seller.isVerified} />
            <span aria-hidden="true">&middot;</span>
            {formatRelativeTime(listing.createdAt)}
          </p>
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
