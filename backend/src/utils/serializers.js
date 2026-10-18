// Convert database rows (snake_case) into the JSON shapes the frontend expects
// (camelCase, see frontend/src/types/index.ts). Secrets like password_hash never leave here.

export function toUser(row, { includePrivate = false } = {}) {
  const user = {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    major: row.major,
    graduationYear: row.graduation_year,
    bio: row.bio,
    isVerified: row.is_verified,
    createdAt: row.created_at,
  };
  // Private: only shown to the account owner. (Buyers do see the Bakong account inside a KHQR.)
  if (includePrivate) {
    user.email = row.email;
    user.bakongAccountId = row.bakong_account_id;
  }
  return user;
}

/** Expects a listing row joined with seller columns (seller_name, seller_avatar_url, ...), see LISTING_SELECT. */
export function toListing(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    cashTopup: row.cash_topup === null ? null : Number(row.cash_topup),
    category: row.category,
    condition: row.condition,
    listingType: row.listing_type,
    imageUrls: row.image_urls,
    sellerId: row.user_id,
    status: row.status,
    createdAt: row.created_at,
    saveCount: row.save_count, // how many students saved it; who saved it is never sent
    auction: row.listing_type === "auction" ? toAuction(row) : null,
    seller: {
      id: row.user_id,
      name: row.seller_name,
      avatarUrl: row.seller_avatar_url,
      isVerified: row.seller_is_verified,
      acceptsKhqr: row.seller_accepts_khqr, // has a Bakong account, so buyers can pay by KHQR
    },
  };
}

/** Auction details for an auction listing row (see LISTING_SELECT). */
function toAuction(row) {
  return {
    endsAt: row.auction_ends_at,
    ended: row.auction_ended,
    minIncrement: Number(row.min_increment),
    highestBid: row.highest_bid === null ? null : Number(row.highest_bid),
    leadingBidderId: row.leading_bidder_id,
    bidCount: row.bid_count,
  };
}

export function toBid(row) {
  return {
    id: row.id,
    amount: Number(row.amount),
    createdAt: row.created_at,
    bidder: { id: row.bidder_id, name: row.bidder_name, isVerified: row.bidder_is_verified },
  };
}

/** Expects a review row joined with reviewer and listing columns (REVIEW_SELECT in routes/reviews.js). */
export function toReview(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    revieweeId: row.reviewee_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    reviewer: { id: row.reviewer_id, name: row.reviewer_name, avatarUrl: row.reviewer_avatar_url },
  };
}

export function toMessage(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    body: row.content,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}
