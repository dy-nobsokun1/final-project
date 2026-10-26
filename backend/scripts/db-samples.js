// Adds the 60 sample listings in sample-listings.json (made by fetch-sample-listings.js) under 6 demo
// students, keeping everything already in the database. Safe to re-run: items already added are skipped.
//   npm run db:samples                 add them
//   npm run db:samples -- --remove     remove the demo students and everything they posted
// Demo data only. Inserted directly with SQL, so no "wanted match" alerts are emailed.
import { readFile } from "node:fs/promises";
import { pool, withTransaction } from "../src/db/pool.js";
import { hashPassword } from "../src/utils/password.js";

const DEMO_EMAILS = "%@demo.edu.kh"; // every demo seller's address ends like this
const HOUR = 60 * 60 * 1000;

if (process.argv.includes("--remove")) {
  // ON DELETE CASCADE also removes their listings and what hangs off them (messages, offers, bids...).
  const { rowCount } = await pool.query("DELETE FROM users WHERE email LIKE $1", [DEMO_EMAILS]);
  console.log(`Removed ${rowCount} demo sellers and all their listings.`);
  await pool.end();
  process.exit(0);
}

const { sellers, listings } = JSON.parse(await readFile(new URL("./sample-listings.json", import.meta.url), "utf8"));
const passwordHash = await hashPassword("password123");

const added = await withTransaction(async (client) => {
  const sellerIds = [];
  for (const seller of sellers) {
    // On a re-run the seller already exists, so this inserts nothing and the SELECT finds them.
    await client.query(
      `INSERT INTO users (name, email, password_hash, major, graduation_year, is_verified)
       VALUES ($1, $2, $3, $4, $5, true) ON CONFLICT (email) DO NOTHING`,
      [seller.name, seller.email, passwordHash, seller.major, seller.graduationYear],
    );
    sellerIds.push((await client.query("SELECT id FROM users WHERE email = $1", [seller.email])).rows[0].id);
  }

  let count = 0;
  for (const item of listings) {
    // Posted `hoursAgo` hours ago, so the browse page looks like a few weeks of real posts.
    const createdAt = new Date(Date.now() - item.hoursAgo * HOUR);
    const auctionEndsAt = item.auction ? new Date(Date.now() + item.auction.days * 24 * HOUR) : null;
    const { rowCount } = await client.query(
      `INSERT INTO listings (user_id, title, description, category, condition, listing_type, price,
                             image_urls, auction_ends_at, min_increment, created_at, updated_at)
       SELECT $1::uuid, $2::text, $3, $4, $5, $6, $7, $8::text[], $9::timestamptz, $10, $11, $11
       WHERE NOT EXISTS (SELECT 1 FROM listings WHERE user_id = $1::uuid AND title = $2::text)`,
      [sellerIds[item.seller], item.title, item.description, item.category, item.condition, item.type,
        item.price, item.images, auctionEndsAt, item.auction?.minIncrement ?? 1, createdAt],
    );
    count += rowCount;
  }
  return count;
});

console.log(`Added ${added} sample listings (${listings.length - added} were already there) for ${sellers.length} demo `
  + `sellers. Log in as ${sellers[0].email} (password "password123") to see one seller's side.`);
await pool.end();
