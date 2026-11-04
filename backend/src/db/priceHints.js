import { closestMatches, titleWords, toPriceHint } from "../utils/listingDraft.js";
import { query } from "./pool.js";

// The price hint of "Fill in from photo" comes only from UniSwap's own listings, never from the AI.
// The AI's title is only used to find similar items.

/** How many of the closest matches the range is made from, so a long list does not stretch it. */
const MAX_MATCHES = 8;

/** One of the AI title's words ($2) as a full-text query; a stop word ("of", "with") gives an empty one. */
const WORD_QUERY = "plainto_tsquery('english', w.word)";

/**
 * { low, high, count, sold } from the closest similar listings, or null with fewer than 2.
 * Similar: same category, and its TITLE has words of the AI's title (with the same stemming as search,
 * so "laptops" counts as "laptop"). Descriptions, related words and typos are left out on purpose:
 * they found laptop RAM for a MacBook. Then only the rows sharing the most words count (closestMatches).
 * Only "sale" listings with a price count: not wanted posts or giveaways, and not auctions, whose price
 * is only the starting bid. Sold ones are used when there are 2 or more, at the amount really paid
 * (else the accepted offer, else the asking price); otherwise sold and active together.
 * The word count runs on every sale listing of the category: fine at campus size, no index needed.
 */
export async function findPriceHint({ category, title }) {
  const words = titleWords(title);
  if (words.length === 0) return null;
  const { rows } = await query(
    `SELECT * FROM (
       SELECT l.status, l.price, l.created_at,
              (SELECT count(*) FROM unnest($2::text[]) AS w(word)
               WHERE numnode(${WORD_QUERY}) > 0
                 AND to_tsvector('english', l.title) @@ ${WORD_QUERY}) AS shared,
              (SELECT p.amount FROM payments p
               WHERE p.listing_id = l.id AND p.status = 'paid' ORDER BY p.paid_at LIMIT 1) AS paid_amount,
              (SELECT o.amount FROM offers o
               WHERE o.listing_id = l.id AND o.buyer_id = l.reserved_for AND o.status = 'accepted') AS agreed_price
       FROM listings l
       WHERE l.category = $1 AND l.listing_type = 'sale' AND l.price > 0 AND l.status IN ('active', 'sold')
     ) AS candidates
     WHERE shared > 0
     ORDER BY shared DESC, created_at DESC
     LIMIT 40`,
    [category, words],
  );
  // How many of the title's words are real words, not stop words: closestMatches needs 2 in common
  // when there are 3 or more.
  const { rows: [{ count }] } = await query(
    `SELECT count(*) FROM unnest($1::text[]) AS w(word) WHERE numnode(${WORD_QUERY}) > 0`,
    [words],
  );
  const closest = closestMatches(rows, Number(count));
  const amount = (row) => Number(row.status === "sold"
    ? row.paid_amount ?? Math.min(Number(row.agreed_price ?? Infinity), Number(row.price))
    : row.price);
  const sold = closest.filter((row) => row.status === "sold");
  if (sold.length >= 2) return toPriceHint(sold.slice(0, MAX_MATCHES).map(amount), true);
  return toPriceHint(closest.slice(0, MAX_MATCHES).map(amount), false);
}
