import { query } from "./pool.js";

/**
 * Closes every auction whose end time has passed and that has at least one bid: the listing
 * becomes "reserved" for the highest bidder, who then arranges the handover with the seller in chat.
 * An auction that ends with no bids stays "active", so the seller can extend it or change its type.
 * Returns one row per closed auction: { listing_id, title, seller_id, winner_id, amount }.
 */
export async function closeEndedAuctions() {
  const { rows } = await query(
    // `winners` = the highest bid of each ended, still-active auction (earlier bid wins a tie).
    `WITH winners AS (
       SELECT DISTINCT ON (b.listing_id) b.listing_id, b.bidder_id, b.amount
       FROM bids b
       JOIN listings l ON l.id = b.listing_id
       WHERE l.listing_type = 'auction' AND l.status = 'active' AND l.auction_ends_at <= now()
       ORDER BY b.listing_id, b.amount DESC, b.created_at ASC
     )
     UPDATE listings l
     SET status = 'reserved', updated_at = now()
     FROM winners w
     WHERE l.id = w.listing_id
     RETURNING l.id AS listing_id, l.title, l.user_id AS seller_id, w.bidder_id AS winner_id, w.amount`,
  );
  return rows;
}
