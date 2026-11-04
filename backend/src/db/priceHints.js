import { anyWordSearch, toPriceHint } from "../utils/listingDraft.js";
import { wordMatchSql } from "./listings.js";
import { query } from "./pool.js";

// The price hint of "Fill in from photo" comes only from UniSwap's own listings, never from the AI.
// The AI's title is only used to find similar items.

/** How many of the best matches the range is made from, so a far-off match does not stretch it. */
const MAX_MATCHES = 8;

/**
 * { low, high, count, sold } from similar listings (same category, a word of the title in common), or
 * null with fewer than 2. Only "sale" listings with a price count: not wanted posts or giveaways, and not
 * auctions, whose price is only the starting bid. Sold ones are used when there are 2 or more, at the
 * amount really paid (else the accepted offer, else the asking price); otherwise sold and active together.
 */
export async function findPriceHint({ category, title }) {
  const search = anyWordSearch(title);
  if (!search) return null;
  const words = wordMatchSql("l", "$2");
  const { rows } = await query(
    `SELECT l.status, l.price,
            (SELECT p.amount FROM payments p
             WHERE p.listing_id = l.id AND p.status = 'paid' ORDER BY p.paid_at LIMIT 1) AS paid_amount,
            (SELECT o.amount FROM offers o
             WHERE o.listing_id = l.id AND o.buyer_id = l.reserved_for AND o.status = 'accepted') AS agreed_price
     FROM listings l
     WHERE l.category = $1 AND l.listing_type = 'sale' AND l.price > 0
       AND l.status IN ('active', 'sold') AND ${words.matches}
     ORDER BY ${words.rank} DESC, l.created_at DESC
     LIMIT 40`,
    [category, search],
  );
  const amount = (row) => Number(row.status === "sold"
    ? row.paid_amount ?? Math.min(Number(row.agreed_price ?? Infinity), Number(row.price))
    : row.price);
  const sold = rows.filter((row) => row.status === "sold");
  if (sold.length >= 2) return toPriceHint(sold.slice(0, MAX_MATCHES).map(amount), true);
  return toPriceHint(rows.slice(0, MAX_MATCHES).map(amount), false);
}
