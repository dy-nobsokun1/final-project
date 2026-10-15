import Link from "next/link";
import { RatingStars } from "@/components/profile/RatingStars";
import { formatRelativeTime } from "@/lib/utils";
import type { Review } from "@/types";

interface ReviewListProps {
  reviews: Review[];
}

/** The reviews a student received, newest first, each linked to its reviewer and listing. */
export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">No reviews yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {reviews.map((review) => (
        <li key={review.id} className="flex flex-col gap-1 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <RatingStars rating={review.rating} />
            <Link href={`/profile/${review.reviewer.id}`} className="font-medium hover:underline">
              {review.reviewer.name}
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(review.createdAt)} ·{" "}
              <Link href={`/listings/${review.listingId}`} className="hover:underline">
                {review.listingTitle}
              </Link>
            </span>
          </div>
          {review.comment ? <p className="text-sm text-foreground">{review.comment}</p> : null}
        </li>
      ))}
    </ul>
  );
}
