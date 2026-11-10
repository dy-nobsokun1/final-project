import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { RatingStars } from "@/components/profile/RatingStars";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { getUserReviews } from "@/lib/api";
import type { ReviewSummary, User } from "@/types";

interface ListingSellerCardProps {
  seller: Pick<User, "id" | "name" | "avatarUrl" | "isVerified">;
  /** True on your own listing: the link then says "Your profile". */
  isOwner: boolean;
}

/**
 * Who posted the listing: photo, name, verified badge, their star rating and a link to their other
 * listings. It loads the reviews itself, so React fetches them at the same time as the rest of the
 * page (no extra wait). The rating is extra: if the API cannot answer, the card shows without it.
 */
export async function ListingSellerCard({ seller, isOwner }: ListingSellerCardProps) {
  const reviews: ReviewSummary | null = await getUserReviews(seller.id).catch((error) => {
    console.error(error);
    return null;
  });
  const firstName = seller.name.split(" ")[0];

  return (
    <section aria-label="Posted by" className="light-surface flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-foreground">
      <UserAvatar name={seller.name} src={seller.avatarUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={`/profile/${seller.id}`} className="flex items-center gap-1 font-medium hover:underline">
          {seller.name}
          <VerifiedBadge isVerified={seller.isVerified} />
        </Link>
        {reviews === null ? null : reviews.averageRating === null ? (
          <p className="text-xs text-muted-foreground">No reviews yet</p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RatingStars rating={reviews.averageRating} />
            {reviews.averageRating.toFixed(1)} ({reviews.reviewCount} {reviews.reviewCount === 1 ? "review" : "reviews"})
          </p>
        )}
      </div>
      <Link
        href={`/profile/${seller.id}`}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-inset px-3 py-2 text-sm font-medium hover:underline"
      >
        {isOwner ? "Your profile" : `More from ${firstName}`}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}
