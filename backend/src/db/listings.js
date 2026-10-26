import { MAX_BROWSE_LIMIT } from "../utils/validation.js";
import { query } from "./pool.js";
import { relatedSearch } from "./relatedWords.js";

// Every listing is returned with the seller's public info, so the UI can render
// a card without a second request (matches ListingWithSeller in the frontend).
// Auction listings also get their highest bid, its bidder, the bid count and whether bidding has ended.
// Every listing also gets save_count: how many students saved it (who they are stays private).
// agreed_price is the price agreed in the accepted offer of the buyer the item is reserved for
// (reserved_for, routes/offers.js), else null. It is private: toListing leaves it out, and only
// amountToPay (utils/payments.js) reads it. offers_one_accepted_idx guarantees at most one such offer.
export const LISTING_SELECT = `
  SELECT l.*, u.name AS seller_name, u.avatar_url AS seller_avatar_url,
         u.is_verified AS seller_is_verified, u.bakong_account_id IS NOT NULL AS seller_accepts_khqr,
         l.auction_ends_at <= now() AS auction_ended,
         top.amount AS highest_bid, top.bidder_id AS leading_bidder_id,
         (SELECT COUNT(*)::int FROM bids b WHERE b.listing_id = l.id) AS bid_count,
         (SELECT COUNT(*)::int FROM saved_listings sv WHERE sv.listing_id = l.id) AS save_count,
         (SELECT o.amount FROM offers o
          WHERE o.listing_id = l.id AND o.buyer_id = l.reserved_for AND o.status = 'accepted') AS agreed_price
  FROM listings l
  JOIN users u ON u.id = l.user_id
  LEFT JOIN LATERAL (
    SELECT amount, bidder_id FROM bids b
    WHERE b.listing_id = l.id
    ORDER BY amount DESC, created_at ASC  -- on a tie, the earlier bid wins
    LIMIT 1
  ) top ON true`;

// How close a misspelled word must be to a title word to count as a match (0 to 1).
// 0.5 lets "frige" find "fridge" (0.50) and "calculs" find "Calculus" (0.75), while unrelated
// titles in our test data score 0.33 or lower.
const TYPO_THRESHOLD = 0.5;
// The typo test needs a term of at least this many characters. Shorter ones share too much with
// any word that starts the same way: "ram" scores 0.5 for "racket".
const TYPO_MIN_LENGTH = 4;

// In ILIKE patterns, % and _ are wildcards. Escape them so a search for "%" means a literal "%".
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Search's two word tests, as SQL for listing `alias` and a search `term`. The term is SQL too: a $n
 * parameter when a student searches, or a wanted post's title in db/matches.js, so both follow one rule.
 * Both arguments come from our own code, never from a request.
 *  - full-text search on title, description and category, ignoring word endings ("textbook" finds the "textbooks" category)
 *  - a typo of a title word: "calculs" finds "Calculus" (pg_trgm). Only for terms of 4+ characters
 *    (TYPO_MIN_LENGTH), checked in SQL, so the term stays a parameter. Wanted matches follow it too.
 * `rank` scores a match: the full-text score (title words count more) plus how closely the title matches.
 */
export function wordMatchSql(alias, term) {
  return {
    matches: `(${alias}.search_vector @@ websearch_to_tsquery('english', ${term})
      OR (char_length(trim(${term})) >= ${TYPO_MIN_LENGTH}
          AND word_similarity(${term}, ${alias}.title) >= ${TYPO_THRESHOLD}))`,
    rank: `ts_rank(${alias}.search_vector, websearch_to_tsquery('english', ${term}))
               + word_similarity(${term}, ${alias}.title)`,
  };
}

export async function findListingById(id) {
  const { rows } = await query(`${LISTING_SELECT} WHERE l.id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Builds the browse/search SQL from filters made by parseListingFilters.
 * Without a search term: newest first. With one: best match first.
 * Returns { text, params } for query(). Every value is a $n parameter, never pasted into the SQL.
 */
export function buildBrowseQuery(filters) {
  const conditions = [];
  const params = [];
  // Adds one filter: each "?" becomes the next $n placeholder, and the value goes into params.
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.replaceAll("?", `$${params.length}`));
  };

  add("l.status = ?", filters.status);
  if (filters.category) add("l.category = ?", filters.category);
  if (filters.condition) add("l.condition = ?", filters.condition);
  if (filters.listingType) add("l.listing_type = ?", filters.listingType);
  if (filters.minPrice !== undefined) add("l.price >= ?", filters.minPrice);
  if (filters.maxPrice !== undefined) add("l.price <= ?", filters.maxPrice);

  let orderBy = "l.created_at DESC";
  if (filters.query) {
    params.push(filters.query, `%${escapeLike(filters.query)}%`);
    const words = wordMatchSql("l", `$${params.length - 1}`);
    const pattern = `$${params.length}`;
    // A listing matches if either word test does (see wordMatchSql), or the term is part of a word in
    // its title or description: "mac" finds "MacBook".
    const ownWords = `(${words.matches} OR l.title ILIKE ${pattern} OR l.description ILIKE ${pattern})`;
    const related = relatedSearch(filters.query);
    if (related) {
      // Related words (db/relatedWords.js) find more listings, through full-text only: "gpu" also
      // finds "RTX 3090". Listings that match the student's own words come first, in the same order
      // as without related words; the related words' score only orders the listings found through them.
      params.push(related);
      const relatedQuery = `websearch_to_tsquery('english', $${params.length})`;
      conditions.push(`(${ownWords} OR l.search_vector @@ ${relatedQuery})`);
      const relatedRank = `ts_rank(l.search_vector, ${relatedQuery})`;
      orderBy = `${ownWords} DESC, CASE WHEN ${ownWords} THEN ${words.rank} ELSE ${relatedRank} END DESC, l.created_at DESC`;
    } else {
      conditions.push(ownWords);
      orderBy = `${words.rank} DESC, l.created_at DESC`;
    }
  }

  // At most `limit` rows (1 to 100, see parseListingFilters); 100 when the caller gives none.
  params.push(filters.limit ?? MAX_BROWSE_LIMIT);
  return {
    text: `${LISTING_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY ${orderBy} LIMIT $${params.length}`,
    params,
  };
}
