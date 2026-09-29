import Link from "next/link";
import { ListingImage } from "@/components/listings/ListingImage";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, conditionLabel } from "@/lib/constants";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import type { ListingWithSeller } from "@/types";

const STATUS_VARIANTS = {
  active: "secondary",
  reserved: "default",
  sold: "outline",
} as const;

interface ListingCardProps {
  listing: ListingWithSeller;
}

/** Summary card used on the browse, search and seller pages. */
export function ListingCard({ listing }: ListingCardProps) {
  const category = CATEGORIES.find((item) => item.value === listing.category);
  const isUnavailable = listing.status !== "active";

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md"
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
              {listing.status === "sold" ? "Sold" : "Reserved"}
            </Badge>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-medium text-zinc-900 group-hover:underline">
            {listing.title}
          </h3>
          <p className="shrink-0 font-semibold">{formatPrice(listing.price)}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {category ? <span className={category.accent + " rounded-full px-2 py-0.5 text-xs"}>{category.label}</span> : null}
          <span className="text-xs text-zinc-500">{conditionLabel(listing.condition)}</span>
        </div>

        <p className="flex items-center gap-1 text-xs text-zinc-500">
          {listing.seller.name}
          <VerifiedBadge isVerified={listing.seller.isVerified} />
          <span aria-hidden="true">&middot;</span>
          {formatRelativeTime(listing.createdAt)}
        </p>
      </div>
    </Link>
  );
}

