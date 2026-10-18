import { Router } from "express";
import { findListingById } from "../db/listings.js";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";
import { toReview } from "../utils/serializers.js";
import { validateReview } from "../utils/validation.js";

// Reviews follow the ER diagram: each one is about one listing, written by one user about another.
// Who may review whom: once a listing is sold or traded, its owner and the person they dealt with
// can rate each other, once per listing (see reviewBlocker below for who counts as "dealt with").

const REVIEW_SELECT = `
  SELECT r.*, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar_url, l.title AS listing_title
  FROM reviews r
  JOIN users u ON u.id = r.reviewer_id
  JOIN listings l ON l.id = r.listing_id`;

// Mounted at /api/listings/:id/reviews and /api/users/:id/reviews. mergeParams lets them read :id.
export const listingReviewsRouter = Router({ mergeParams: true });
export const userReviewsRouter = Router({ mergeParams: true });

/**
 * The person the owner completed the deal with, when UniSwap knows it: whoever paid online
 * (card or KHQR), or else the winner of an auction. null for a deal settled in person.
 */
async function findDealPartner(listing) {
  const { rows } = await query(
    "SELECT buyer_id FROM payments WHERE listing_id = $1 AND status = 'paid' ORDER BY paid_at LIMIT 1",
    [listing.id],
  );
  if (rows[0]) return rows[0].buyer_id;
  return listing.listing_type === "auction" ? listing.leading_bidder_id : null;
}

/**
 * Why `reviewerId` may not review `revieweeId` about this listing (an HttpError), or null if they may.
 * The two must be the listing's owner and the person they dealt with:
 *  - if someone paid online, or won the auction, only that person;
 *  - otherwise (settled in person), someone who chatted with the owner about it, both ways.
 */
async function reviewBlocker(listing, reviewerId, revieweeId) {
  if (revieweeId === reviewerId) return new HttpError(400, "You cannot review yourself.");
  if (listing.status !== "sold" && listing.status !== "traded") {
    return new HttpError(400, "You can leave a review once the listing is marked sold or traded.");
  }
  if (listing.user_id !== reviewerId && listing.user_id !== revieweeId) {
    return new HttpError(403, "Reviews are between a listing's owner and the person they dealt with.");
  }
  const other = listing.user_id === reviewerId ? revieweeId : reviewerId;
  const partner = await findDealPartner(listing);
  if (partner) {
    return partner === other ? null : new HttpError(403, "Only the buyer and the seller can review each other.");
  }
  const { rows: [chat] } = await query(
    `SELECT EXISTS (SELECT 1 FROM messages WHERE listing_id = $1 AND sender_id = $2 AND receiver_id = $3)
        AND EXISTS (SELECT 1 FROM messages WHERE listing_id = $1 AND sender_id = $3 AND receiver_id = $2)
        AS both_wrote`,
    [listing.id, reviewerId, revieweeId],
  );
  return chat.both_wrote ? null : new HttpError(403, "You can only review someone you chatted with about this listing.");
}

// GET /api/listings/:id/reviews/can-review?revieweeId=  (logged in) -> { allowed, reason }
// Lets the chat page show the review form only when the API would accept the review.
listingReviewsRouter.get("/can-review", requireAuth, async (req, res) => {
  const listing = await findListingById(req.params.id);
  if (!listing) throw new HttpError(404, "Listing not found.");
  const blocker = await reviewBlocker(listing, req.userId, String(req.query.revieweeId ?? ""));
  res.json({ allowed: !blocker, reason: blocker?.message ?? null });
});

// GET /api/listings/:id/reviews  -> reviews about this listing's deal (at most one per person)
listingReviewsRouter.get("/", async (req, res) => {
  const { rows } = await query(`${REVIEW_SELECT} WHERE r.listing_id = $1 ORDER BY r.created_at`, [req.params.id]);
  res.json({ reviews: rows.map(toReview) });
});

// POST /api/listings/:id/reviews  { revieweeId, rating, comment? }  (logged in)
listingReviewsRouter.post("/", requireAuth, async (req, res) => {
  const errors = validateReview(req.body);
  if (Object.keys(errors).length) throw new HttpError(400, "Please fix the highlighted fields.", errors);
  const { revieweeId, rating } = req.body;

  const listing = await findListingById(req.params.id);
  if (!listing) throw new HttpError(404, "Listing not found.");
  const blocker = await reviewBlocker(listing, req.userId, revieweeId);
  if (blocker) throw blocker;

  // UNIQUE (listing_id, reviewer_id) in schema.sql: one review per person per listing.
  const { rows } = await query(
    `INSERT INTO reviews (listing_id, reviewer_id, reviewee_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (listing_id, reviewer_id) DO NOTHING
     RETURNING id`,
    [listing.id, req.userId, revieweeId, rating, (req.body.comment ?? "").trim()],
  );
  if (!rows[0]) throw new HttpError(409, "You have already reviewed this listing.");
  const { rows: [review] } = await query(`${REVIEW_SELECT} WHERE r.id = $1`, [rows[0].id]);
  res.status(201).json({ review: toReview(review) });
});

// GET /api/users/:id/reviews  -> reviews this user received, newest first, and their average rating
userReviewsRouter.get("/", async (req, res) => {
  const { rows } = await query(`${REVIEW_SELECT} WHERE r.reviewee_id = $1 ORDER BY r.created_at DESC`, [req.params.id]);
  const total = rows.reduce((sum, row) => sum + row.rating, 0);
  res.json({
    reviews: rows.map(toReview),
    // Rounded to one decimal place, e.g. 4.3. null until the first review.
    averageRating: rows.length ? Math.round((total / rows.length) * 10) / 10 : null,
    reviewCount: rows.length,
  });
});
