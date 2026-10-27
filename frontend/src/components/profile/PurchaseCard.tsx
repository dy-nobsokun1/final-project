"use client";

import Link from "next/link";
import { useState } from "react";
import { ListingImage } from "@/components/listings/ListingImage";
import { RatingStars } from "@/components/profile/RatingStars";
import { ReviewForm } from "@/components/profile/ReviewForm";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import type { Purchase } from "@/types";

/** The one line about what happened, e.g. "Paid $45 by card". */
function describe({ how, amount }: Purchase): string {
  const price = formatPrice(amount);
  switch (how) {
    case "card": return `Paid ${price} by card`;
    case "khqr": return `Paid ${price} with KHQR`;
    case "auction": return `Won at auction for ${price}`;
    case "offer": return `Bought for ${price} (offer)`;
    case "trade": return "Traded";
    case "free": return "Free";
  }
}

/** One purchase: the item, what happened, the seller, and a review (or your stars). */
export function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const [isReviewing, setIsReviewing] = useState(false);
  const { listing, at, myRating } = purchase;
  const { seller } = listing;
  const date = at ? new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;

  return (
    <div className="light-surface flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex gap-3">
        <Link href={`/listings/${listing.id}`} className="shrink-0">
          <ListingImage src={listing.imageUrls[0]} alt={listing.title} className="size-24 rounded-lg object-cover" />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <Link href={`/listings/${listing.id}`} className="truncate font-medium hover:underline">
            {listing.title}
          </Link>
          <p className="text-sm">{describe(purchase)}{date ? ` · ${date}` : ""}</p>
          <Link href={`/profile/${seller.id}`} className="flex items-center gap-2 text-sm hover:underline">
            <UserAvatar name={seller.name} src={seller.avatarUrl} size="sm" />
            <span className="truncate">{seller.name}</span>
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {myRating === null ? (
          <Button type="button" size="sm" onClick={() => setIsReviewing((open) => !open)} aria-expanded={isReviewing}>
            Review seller
          </Button>
        ) : (
          <span className="flex items-center gap-2 text-sm">You rated <RatingStars rating={myRating} /></span>
        )}
        <Link href={`/profile/${seller.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          More from {seller.name.split(" ")[0]}
        </Link>
      </div>
      {isReviewing && myRating === null ? <ReviewForm listingId={listing.id} reviewee={seller} /> : null}
    </div>
  );
}
