import { Router } from "express";
import { findListingById } from "../db/listings.js";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";
import { toReview } from "../utils/serializers.js";
import { validateReview } from "../utils/validation.js";

// Reviews follow the ER diagram: each one is about one listing, written by one user about another.
// Who may review whom: once a listing is sold or traded, its owner and a person they dealt with
// (both of them wrote at least one message about that listing) can rate each other, once per listing.

const REVIEW_SELECT = `
  SELECT r.*, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar_url, l.title AS listing_title
  FROM reviews r
  JOIN users u ON u.id = r.reviewer_id
  JOIN listings l ON l.id = r.listing_id`;

// Mounted at /api/listings/:id/reviews and /api/users/:id/reviews. mergeParams lets them read :id.
export const listingReviewsRouter = Router({ mergeParams: true });
export const userReviewsRouter = Router({ mergeParams: true });

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
  if (revieweeId === req.userId) throw new HttpError(400, "You cannot review yourself.");

  const listing = await findListingById(req.params.id);
  if (!listing) throw new HttpError(404, "Listing not found.");
  if (listing.status !== "sold" && listing.status !== "traded") {
    throw new HttpError(400, "You can leave a review once the listing is marked sold or traded.");
  }
  if (listing.user_id !== req.userId && listing.user_id !== revieweeId) {
    throw new HttpError(403, "Reviews are between a listing's owner and the person they dealt with.");
  }
  const { rows: [chat] } = await query(
    `SELECT EXISTS (SELECT 1 FROM messages WHERE listing_id = $1 AND sender_id = $2 AND receiver_id = $3)
        AND EXISTS (SELECT 1 FROM messages WHERE listing_id = $1 AND sender_id = $3 AND receiver_id = $2)
        AS both_wrote`,
    [listing.id, req.userId, revieweeId],
  );
  if (!chat.both_wrote) throw new HttpError(403, "You can only review someone you chatted with about this listing.");

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
