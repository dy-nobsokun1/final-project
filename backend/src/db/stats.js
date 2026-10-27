import { LISTING_SELECT } from "./listings.js";
import { query } from "./pool.js";

// How many months the earnings and spending charts show, this month included.
const CHART_MONTHS = 6;
// Months are counted in Cambodian time (the database runs in UTC), so a deal late on the 31st
// does not land in the next month.
const TIME_ZONE = "Asia/Phnom_Penh";

/**
 * The user's completed deals, one row each: listings now sold or traded (wanted posts never count),
 * where the user is the owner or the buyer. The buyer is picked like findDealPartner in
 * routes/reviews.js: whoever paid online first, else the auction's winner, else the buyer whose offer
 * was accepted. Reviews also accept "chatted both ways", but that is too loose for money totals.
 *
 * - role: "sale" or "purchase", or "trade" on either side; isOwner: it was the user's own listing.
 * - amount: the paid amount, else the winning bid, else the agreed price (or the asking price if
 *   lower), else the asking price. A giveaway is $0. A trade counts only its cash top-up (the cash
 *   asked on top of the swapped item, as utils/assistant.js describes it), and only for the owner.
 * - month: when it happened (paid_at, else sold_at), as "YYYY-MM" in Cambodian time.
 */
async function findDeals(userId) {
  const { rows } = await query(
    `WITH closed AS (
       SELECT l.user_id, l.category, l.status,
              COALESCE(paid.buyer_id,
                       CASE WHEN l.listing_type = 'auction' THEN l.leading_bidder_id ELSE l.reserved_for END) AS buyer_id,
              CASE WHEN l.status = 'traded' THEN COALESCE(l.cash_topup, 0)
                   WHEN l.listing_type = 'giveaway' THEN 0
                   ELSE COALESCE(paid.amount,
                                 CASE WHEN l.listing_type = 'auction' THEN l.highest_bid END,
                                 LEAST(l.agreed_price, l.price)) -- LEAST skips a NULL agreed_price
              END AS amount,
              COALESCE(paid.paid_at, l.sold_at) AS deal_at
       FROM (${LISTING_SELECT}
             WHERE l.status IN ('sold', 'traded') AND l.listing_type <> 'buy_request'
               AND (l.user_id = $1 OR l.reserved_for = $1
                    OR EXISTS (SELECT 1 FROM payments p WHERE p.listing_id = l.id AND p.buyer_id = $1)
                    OR EXISTS (SELECT 1 FROM bids b WHERE b.listing_id = l.id AND b.bidder_id = $1))) l
       LEFT JOIN LATERAL (
         SELECT buyer_id, amount, paid_at FROM payments
         WHERE listing_id = l.id AND status = 'paid' ORDER BY paid_at LIMIT 1
       ) paid ON true
     )
     SELECT category, user_id = $1 AS is_owner,
            CASE WHEN status = 'traded' THEN 'trade' WHEN user_id = $1 THEN 'sale' ELSE 'purchase' END AS role,
            CASE WHEN status = 'traded' AND user_id <> $1 THEN 0 ELSE amount END AS amount,
            to_char(deal_at AT TIME ZONE $2, 'YYYY-MM') AS month
     FROM closed
     WHERE user_id = $1 OR buyer_id = $1`,
    [userId, TIME_ZONE],
  );
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

/** The last CHART_MONTHS months, oldest first, as "YYYY-MM" in Cambodian time. */
async function lastMonths() {
  const { rows } = await query(
    `SELECT to_char(month, 'YYYY-MM') AS month
     FROM generate_series(date_trunc('month', now() AT TIME ZONE $1) - make_interval(months => $2 - 1),
                          date_trunc('month', now() AT TIME ZONE $1), interval '1 month') AS month`,
    [TIME_ZONE, CHART_MONTHS],
  );
  return rows.map((row) => row.month);
}

/** Dollars, to the cent. */
function sum(deals) {
  return Math.round(deals.reduce((total, deal) => total + deal.amount, 0) * 100) / 100;
}

/** [{ category, count }], the most first. */
function countByCategory(deals) {
  const counts = new Map();
  for (const deal of deals) counts.set(deal.category, (counts.get(deal.category) ?? 0) + 1);
  return [...counts]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/** GET /api/users/me/stats: the signed-in user's own deal stats. Money only ever goes to its owner. */
export async function getUserStats(userId) {
  const [deals, months, { rows: [counts] }] = await Promise.all([
    findDeals(userId),
    lastMonths(),
    query(
      `SELECT (SELECT COUNT(*)::int FROM listings
               WHERE user_id = $1 AND status = 'active' AND listing_type <> 'buy_request') AS active_listings,
              (SELECT ROUND(AVG(rating), 1)::float FROM reviews WHERE reviewee_id = $1) AS average_rating,
              (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = $1) AS review_count`,
      [userId],
    ),
  ]);
  const owned = deals.filter((deal) => deal.is_owner);
  const purchases = deals.filter((deal) => deal.role === "purchase");

  return {
    deals: deals.length,
    sales: deals.filter((deal) => deal.role === "sale").length,
    purchases: purchases.length,
    trades: deals.filter((deal) => deal.role === "trade").length,
    earned: sum(owned),
    spent: sum(purchases),
    activeListings: counts.active_listings,
    soldListings: owned.length,
    averageRating: counts.average_rating,
    reviewCount: counts.review_count,
    months: months.map((month) => ({
      month,
      earned: sum(owned.filter((deal) => deal.month === month)),
      spent: sum(purchases.filter((deal) => deal.month === month)),
    })),
    soldByCategory: countByCategory(owned),
    boughtByCategory: countByCategory(purchases),
  };
}
