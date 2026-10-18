import { RatingStars } from "@/components/profile/RatingStars";
import { ReviewForm } from "@/components/profile/ReviewForm";
import type { Review, User } from "@/types";

interface ThreadReviewProps {
  listingId: string;
  partner: Pick<User, "id" | "name">;
  meId: string;
  /**
   * From the API (canReview): the listing is sold or traded and these two are its owner and the
   * person they dealt with (whoever paid or won, else someone who chatted with the owner about it).
   */
  mayReview: boolean;
  /** Every review about this listing's deal (see getListingReviews). */
  reviews: Review[];
}

/**
 * Below a chat about a sold or traded listing: the form to rate the other person, or the rating you
 * gave. Each person reviews a listing once.
 */
export function ThreadReview({ listingId, partner, meId, mayReview, reviews }: ThreadReviewProps) {
  const mine = reviews.find((review) => review.reviewer.id === meId);
  if (!mine) return mayReview ? <ReviewForm listingId={listingId} reviewee={partner} /> : null;
  // You already reviewed someone else for this listing (an owner may chat with several people).
  if (mine.revieweeId !== partner.id) return null;

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      You rated {partner.name}
      <RatingStars rating={mine.rating} />
    </p>
  );
}
