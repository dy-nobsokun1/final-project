import { query } from "./pool.js";
import { CLOSED_DEALS_SQL } from "./stats.js";
import { toListing } from "../utils/serializers.js";

/**
 * GET /api/users/me/purchases: what the user bought, newest first. The buyer, amount and date come
 * from the same rule as the profile stats (CLOSED_DEALS_SQL), so the two always agree.
 *
 * - how: "card" or "khqr" (paid online), "free" (giveaway), "trade", else "auction" for the leading
 *   bidder, else "offer".
 * - myRating: the user's own review of the deal (1-5), or null.
 * - amount: 0 for a trade, as in the stats (only the owner counts the cash top-up).
 */
export async function findPurchases(userId, limit) {
  const { rows } = await query(
    `WITH closed AS (${CLOSED_DEALS_SQL})
     SELECT c.*,
            (SELECT r.rating FROM reviews r WHERE r.listing_id = c.id AND r.reviewer_id = $1) AS my_rating
     FROM closed c
     WHERE c.buyer_id = $1 AND c.user_id <> $1
     ORDER BY c.deal_at DESC NULLS LAST, c.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map((row) => ({
    listing: toListing(row),
    amount: row.status === "traded" ? 0 : Number(row.amount),
    at: row.deal_at,
    how: howBought(row),
    myRating: row.my_rating,
  }));
}

function howBought(row) {
  if (row.paid_method) return row.paid_method === "khqr" ? "khqr" : "card";
  if (row.status === "traded") return "trade";
  if (row.listing_type === "giveaway") return "free";
  return row.listing_type === "auction" ? "auction" : "offer";
}
