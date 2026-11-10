// Re-opens demo auctions by setting their end time 7 days into the future,
// ensuring the RTX 3090, City bike, and Calculus textbook are always ready for live demos.
//   npm run db:open-auctions
import { pool, withTransaction } from "../src/db/pool.js";

// The 9 finished demo deals for Chanrithorn must stay intact
const DEMO_DEAL_TITLES = [
  "Graphing calculator (auction)",
  "Road bike (auction)",
];

await withTransaction(async (client) => {
  // 1. Re-open RTX 3090 with fresh starting bid
  const { rows: [rtx] } = await client.query(`
    UPDATE listings
    SET status = 'active',
        price = 450.00,
        min_increment = 10.00,
        auction_ends_at = now() + interval '7 days',
        reserved_for = NULL,
        sold_at = NULL,
        updated_at = now()
    WHERE title = 'Gigabyte RTX 3090 Eagle OC 24GB graphics card'
    RETURNING id, title, price, min_increment, auction_ends_at
  `);

  if (rtx) {
    await client.query("DELETE FROM bids WHERE listing_id = $1", [rtx.id]);
    console.log(`✓ Re-opened "${rtx.title}" at $${rtx.price} (ends ${rtx.auction_ends_at.toISOString().slice(0, 10)})`);
  }

  // 2. Extend any other active auctions (Calculus, City bike)
  const { rows: others } = await client.query(`
    UPDATE listings
    SET auction_ends_at = now() + interval '7 days',
        updated_at = now()
    WHERE listing_type = 'auction'
      AND status = 'active'
      AND title != 'Gigabyte RTX 3090 Eagle OC 24GB graphics card'
      AND title != ALL($1::text[])
    RETURNING title, price, auction_ends_at
  `, [DEMO_DEAL_TITLES]);

  for (const item of others) {
    console.log(`✓ Extended "${item.title}" (ends ${item.auction_ends_at.toISOString().slice(0, 10)})`);
  }

  console.log("\nAll demo auctions are open and ready for presentation!");
});

await pool.end();
