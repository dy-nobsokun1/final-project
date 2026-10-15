import { RatingStars } from "@/components/profile/RatingStars";
import { ReviewForm } from "@/components/profile/ReviewForm";
import type { ListingWithSeller, Message, Review, User } from "@/types";

interface ThreadReviewProps {
  listing: ListingWithSeller;
  partner: Pick<User, "id" | "name">;
  meId: string;
  messages: Message[];
  /** Every review about this listing's deal (see getListingReviews). */
  reviews: Review[];
}

/**
 * Below a chat about a sold or traded listing: the form to rate the other person, or the rating you
 * gave. Mirrors the API's rule (backend/src/routes/reviews.js): both of you wrote in this thread,
 * and each person reviews a listing once.
 */
export function ThreadReview({ listing, partner, meId, messages, reviews }: ThreadReviewProps) {
  const isFinished = listing.status === "sold" || listing.status === "traded";
  const bothWrote = messages.some((message) => message.senderId === meId)
    && messages.some((message) => message.senderId === partner.id);
  if (!isFinished || !bothWrote) return null;

  const mine = reviews.find((review) => review.reviewer.id === meId);
  if (!mine) return <ReviewForm listingId={listing.id} reviewee={partner} />;
  // You already reviewed someone else for this listing (an owner may chat with several people).
  if (mine.revieweeId !== partner.id) return null;

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      You rated {partner.name}
      <RatingStars rating={mine.rating} />
    </p>
  );
}
