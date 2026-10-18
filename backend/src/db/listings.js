import { query } from "./pool.js";

// Every listing is returned with the seller's public info, so the UI can render
// a card without a second request (matches ListingWithSeller in the frontend).
// Auction listings also get their highest bid, its bidder, the bid count and whether bidding has ended.
export const LISTING_SELECT = `
  SELECT l.*, u.name AS seller_name, u.avatar_url AS seller_avatar_url,
         u.is_verified AS seller_is_verified, u.bakong_account_id IS NOT NULL AS seller_accepts_khqr,
         l.auction_ends_at <= now() AS auction_ended,
         top.amount AS highest_bid, top.bidder_id AS leading_bidder_id,
         (SELECT COUNT(*)::int FROM bids b WHERE b.listing_id = l.id) AS bid_count
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

// In ILIKE patterns, % and _ are wildcards. Escape them so a search for "%" means a literal "%".
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
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
    const q = `$${params.length - 1}`;
    const pattern = `$${params.length}`;
    // A listing matches if any of these is true:
    //  1. full-text search on title, description and category, ignoring word endings
    //     ("textbook" finds the "textbooks" category)
    //  2. part of a word: "mac" finds "MacBook"
    //  3. a typo of a title word: "calculs" finds "Calculus" (pg_trgm)
    conditions.push(`(l.search_vector @@ websearch_to_tsquery('english', ${q})
      OR l.title ILIKE ${pattern} OR l.description ILIKE ${pattern}
      OR word_similarity(${q}, l.title) >= ${TYPO_THRESHOLD})`);
    // Rank: full-text score (title words count more) plus how closely the title matches.
    orderBy = `ts_rank(l.search_vector, websearch_to_tsquery('english', ${q}))
               + word_similarity(${q}, l.title) DESC, l.created_at DESC`;
  }

  return {
    text: `${LISTING_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY ${orderBy} LIMIT 100`,
    params,
  };
}
