// Reverts listings that were marked sold back to active, and cleans up linked
// payments, offers, and reviews from test purchases.
//   npm run db:reset-sold                 reverts test-bought items (keeps 9 demo deals intact)
//   npm run db:reset-sold -- --all        reverts all sold items including the 9 demo deals
import { pool, withTransaction } from "../src/db/pool.js";

// Titles of the 9 simulated demo deals created by db:demo-deals for Chanrithorn's profile stats
const DEMO_DEAL_TITLES = [
  "Principles of Marketing textbook",
  "Wireless mouse",
  "Bluetooth speaker",
  "Graphing calculator (auction)",
  "Small bookshelf",
  "Acoustic guitar - trade for a bike lock",
  "Grey hoodie (size M)",
  "Road bike (auction)",
  "Desk chair",
];

const includeAll = process.argv.includes("--all");

await withTransaction(async (client) => {
  // 1. Identify listings to reset:
  // By default: all sold/traded listings NOT in DEMO_DEAL_TITLES.
  // With --all: all sold/traded listings.
  const { rows: targets } = await client.query(
    `SELECT l.id, l.title, l.status
     FROM listings l
     WHERE l.status IN ('sold', 'traded')
       ${includeAll ? "" : "AND l.title != ALL($1::text[])"}
     ORDER BY l.title ASC`,
    includeAll ? [] : [DEMO_DEAL_TITLES],
  );

  if (targets.length === 0) {
    console.log("No test-sold listings found to reset.");
    if (!includeAll) {
      console.log("Note: 9 demo deals for Chanrithorn are kept intact. Pass '-- --all' to reset those too.");
    }
    return;
  }

  const targetIds = targets.map((t) => t.id);

  // 2. Delete linked payments (paid, pending, refund_due)
  const { rowCount: paymentsDeleted } = await client.query(
    "DELETE FROM payments WHERE listing_id = ANY($1)",
    [targetIds],
  );

  // 3. Delete linked reviews
  const { rowCount: reviewsDeleted } = await client.query(
    "DELETE FROM reviews WHERE listing_id = ANY($1)",
    [targetIds],
  );

  // 4. Delete linked offers
  const { rowCount: offersDeleted } = await client.query(
    "DELETE FROM offers WHERE listing_id = ANY($1)",
    [targetIds],
  );

  // 5. Reset listings back to active
  const { rowCount: listingsReset } = await client.query(
    `UPDATE listings
     SET status = 'active',
         sold_at = NULL,
         reserved_for = NULL,
         updated_at = now()
     WHERE id = ANY($1)`,
    [targetIds],
  );

  console.log(`\nSuccessfully reset ${listingsReset} listing(s) back to 'active':`);
  for (const t of targets) {
    console.log(`  • "${t.title}" (${t.id})`);
  }
  console.log(`Cleaned up linked records: ${paymentsDeleted} payment(s), ${offersDeleted} offer(s), ${reviewsDeleted} review(s).`);
  if (!includeAll) {
    console.log("\nNote: Kept 9 demo deals intact for profile stats. Run with '-- --all' if you also want to reset those.");
  }
});

await pool.end();

