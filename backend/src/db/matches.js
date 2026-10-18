import { LISTING_SELECT, wordMatchSql } from "./listings.js";
import { query } from "./pool.js";

// Matching items to "wanted" posts (listing_type 'buy_request'). A wanted post matches an item (for
// sale, trade, giveaway or auction) when:
//  1. searching UniSwap for the wanted post's title would find the item: search's full-text test or
//     its typo test (see wordMatchSql in db/listings.js), after dropping a leading "Looking for",
//     "Wanted:" and the like (WANTED_PREFIX). Search's third test, part of a word ("mac" finds
//     "MacBook"), is left out on purpose: a match can send an email, and "pen" inside "open" is no
//     reason to send one. It would also make an empty term match everything ('%%').
//  2. both are in the same category, unless either one is "Other";
//  3. the item's price (an auction's starting bid) is within the wanted post's price, which is its
//     budget. A budget of 0 means any price;
//  4. both are active, an auction has not ended yet, and they belong to different students.
// Only verified students' wanted posts are listed for an item (findWantedForItem), because alerts
// use that list and UniSwap never emails an address that was not confirmed.

// Dropped from the start of a wanted post's title before it is used as a search term, because it describes
// the post, not the item: "Looking for a TI-84" searches for "a TI-84". PostgreSQL regular expression, used
// with the 'i' (any case) flag; \M is the end of a word, so "Needles" keeps its "Need".
const WANTED_PREFIX = "^\\s*(looking for|searching for|anyone selling|want to buy|wanted|want|wtb|needed|need|buying)\\M[\\s:.-]*";

// The rule as SQL. `item` and `wanted` are table aliases and `term` the wanted post's search term. Both
// queries below use it, the two ways round, so they always agree.
function matchSql(item, wanted, term) {
  const words = wordMatchSql(item, term);
  return {
    // The numnode check: a term with no real words ("Wanted:" alone, or only words like "the") matches
    // nothing. Otherwise the typo test alone would find every title that contains "the".
    where: `${wanted}.listing_type = 'buy_request' AND ${item}.listing_type <> 'buy_request'
      AND ${wanted}.status = 'active' AND ${item}.status = 'active'
      AND (${item}.auction_ends_at IS NULL OR ${item}.auction_ends_at > now())
      AND ${wanted}.user_id <> ${item}.user_id
      AND (${wanted}.category = ${item}.category OR 'other' IN (${wanted}.category, ${item}.category))
      AND (${wanted}.price = 0 OR ${item}.price <= ${wanted}.price)
      AND numnode(websearch_to_tsquery('english', ${term})) > 0
      AND ${words.matches}`,
    rank: words.rank,
  };
}

// In both queries, LISTING_SELECT's `l` is the listing returned and `u` its owner. The LATERAL
// subquery works out each wanted post's search term once. The aliases w, n and t do not clash with
// LISTING_SELECT's own (l, u, top, b, sv, o).

/** Active items that match wanted post `wantedId`, best match first (rows like LISTING_SELECT's). */
export async function findItemsForWanted(wantedId, limit) {
  const match = matchSql("l", "w", "t.term");
  const { rows } = await query(
    `${LISTING_SELECT}
     JOIN listings w ON w.id = $1
     CROSS JOIN LATERAL (SELECT regexp_replace(w.title, $2, '', 'i') AS term) t
     WHERE ${match.where}
     ORDER BY ${match.rank} DESC, l.created_at DESC
     LIMIT $3`,
    [wantedId, WANTED_PREFIX, limit],
  );
  return rows;
}

/**
 * Active wanted posts that item `itemId` matches, best first. Only verified students' posts (here
 * `u` is the wanted poster): alerts use this, and UniSwap never emails an address that was not confirmed.
 */
export async function findWantedForItem(itemId, limit) {
  const match = matchSql("n", "l", "t.term");
  const { rows } = await query(
    `${LISTING_SELECT}
     JOIN listings n ON n.id = $1
     CROSS JOIN LATERAL (SELECT regexp_replace(l.title, $2, '', 'i') AS term) t
     WHERE ${match.where} AND u.is_verified
     ORDER BY ${match.rank} DESC, l.created_at DESC
     LIMIT $3`,
    [itemId, WANTED_PREFIX, limit],
  );
  return rows;
}
