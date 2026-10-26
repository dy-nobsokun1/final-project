import { Images } from "lucide-react";
import Link from "next/link";
import { ListingImage } from "@/components/listings/ListingImage";
import { ListingTypeTag } from "@/components/listings/ListingTypeTag";
import { SaveButton } from "@/components/listings/SaveButton";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, conditionLabel, statusLabel } from "@/lib/constants";
import { formatListingPrice, formatRelativeTime } from "@/lib/utils";
import type { ListingWithSeller } from "@/types";

const STATUS_VARIANTS = {
  active: "secondary",
  reserved: "default",
  sold: "outline",
  traded: "outline",
} as const;

interface ListingCardProps {
  listing: ListingWithSeller;
  /** Whether you saved it. Leave it out to show no heart (e.g. a grid of your own listings). */
  saved?: boolean;
}

/** Summary card used on the browse, search and seller pages. */
export function ListingCard({ listing, saved }: ListingCardProps) {
  const category = CATEGORIES.find((item) => item.value === listing.category);
  const isUnavailable = listing.status !== "active";

  return (
    // The heart sits next to the link, not inside it: a button inside a link is invalid HTML, and
    // clicking it would open the listing too. The lift on hover moves both together.
    <div className="relative transition-transform hover:-translate-y-0.5">
      <Link
        href={`/listings/${listing.id}`}
        className="light-surface group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-brand-600 hover:shadow-lg hover:shadow-brand-600/20"
      >
        <div className="relative">
          <ListingImage
            src={listing.imageUrls[0]}
            alt={listing.title}
            className="aspect-[4/3] w-full"
          />
          {isUnavailable ? (
            <span className="absolute left-2 top-2">
              <Badge variant={STATUS_VARIANTS[listing.status]}>
                {statusLabel(listing.status)}
              </Badge>
            </span>
          ) : null}
          {/* Bottom-left, mirroring the photo count at bottom-right. */}
          <ListingTypeTag type={listing.listingType} className="absolute bottom-2 left-2" />
          {listing.imageUrls.length > 1 ? (
            <Badge variant="secondary" className="absolute bottom-2 right-2">
              <Images aria-hidden="true" />
              {listing.imageUrls.length}<span className="sr-only"> photos</span>
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-medium text-foreground group-hover:underline">
              {listing.title}
            </h3>
            <p className="shrink-0 font-semibold">{formatListingPrice(listing)}</p>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2">
            {category ? <span className={category.accent + " rounded-full px-2 py-0.5 text-xs"}>{category.label}</span> : null}
            <span className="text-xs text-muted-foreground">{conditionLabel(listing.condition)}</span>
          </div>

          {listing.auction ? (
            <p className="text-xs font-medium">
              {listing.auction.bidCount} {listing.auction.bidCount === 1 ? "bid" : "bids"} ·{" "}
              {listing.auction.ended ? "bidding closed" : `ends ${formatRelativeTime(listing.auction.endsAt)}`}
            </p>
          ) : null}

          <p className="flex items-center gap-1 text-xs text-muted-foreground">
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

