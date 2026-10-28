// Inserts demo users, listings and a chat so the API has data to show.  Run: npm run db:seed
// Demo login for every user: password "password123". Development only.
import { pool } from "../src/db/pool.js";
import { hashPassword } from "../src/utils/password.js";

const passwordHash = await hashPassword("password123");

const users = [
  ["Sokunth Navy", "sokunth@aupp.edu.kh", "Computer Science", 2027, true],
  ["Chanrithorn Lim", "chanrithorn@aupp.edu.kh", "Business", 2026, true],
  ["Dara Phal", "dara@aupp.edu.kh", "Architecture", 2028, false],
];

const ids = [];
for (const [name, email, major, year, verified] of users) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, major, graduation_year, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [name, email, passwordHash, major, year, verified],
  );
  ids.push(rows[0].id);
}

// Real photos: the first four are in frontend/public/listings/; the desk and jacket stay on
// Wikimedia Commons (credits next to them), so no third-party images enter this repo.
const DESK_PHOTO = // "(2) 4 drawer Steel desk with wood top", Bonner Springs Library, CC BY 2.0:
  // https://commons.wikimedia.org/wiki/File:(2)_4_drawer_Steel_desk_with_wood_top-front_(4791226493).jpg
  "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/%282%29_4_drawer_Steel_desk_with_wood_top-front_%284791226493%29.jpg/960px-%282%29_4_drawer_Steel_desk_with_wood_top-front_%284791226493%29.jpg";
const JACKET_PHOTO = // "Carhartt Hooded Jacket", Eli Duke, CC BY-SA 2.0:
  // https://commons.wikimedia.org/wiki/File:Carhartt_Hooded_Jacket_(9808828856).jpg
  "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Carhartt_Hooded_Jacket_%289808828856%29.jpg/960px-Carhartt_Hooded_Jacket_%289808828856%29.jpg";

// [owner index, title, category, condition, type, price, description, photos (the first is the cover)]
const listings = [
  [0, "Calculus: Early Transcendentals", "textbooks", "good", "sale", 25,
    "Used it for Calculus I and II. Some highlighting in the first chapters, no missing pages. Can meet at AUPP.",
    ["/listings/calculus-book.jpg"]],
  [0, "Used MacBook Pro M1 (13-inch)", "electronics", "like_new", "sale", 550,
    "8GB RAM, 256GB, battery health 92%. Always used with a case, no dents. Charger included, can meet at AUPP.",
    ["/listings/used-macbook.jpg"]],
  [1, "Mini fridge for dorm", "furniture", "good", "sale", 60,
    "Small and quiet, keeps drinks cold. I'm moving out at the end of the semester. Pick up near AUPP.",
    ["/listings/mini-fridge.avif"]],
  [1, "City bike - trade for a desk", "bikes", "fair", "trade", 0,
    "Rides fine and comes with the front basket, the seat is a bit worn. I'd trade it for a study desk. Can meet at AUPP.",
    ["/listings/bike.jpg"]],
  [2, "Winter jacket (free)", "clothing", "good", "giveaway", 0,
    "Warm hooded jacket I bought for a trip, far too hot for Phnom Penh. Free, pick it up at AUPP.",
    [JACKET_PHOTO]],
];

const listingIds = [];
for (const [owner, title, category, condition, type, price, description, images] of listings) {
  const { rows } = await pool.query(
    `INSERT INTO listings (user_id, title, description, category, condition, listing_type, price, image_urls)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [ids[owner], title, description, category, condition, type, price, images],
  );
  listingIds.push(rows[0].id);
}

// A short chat: Chanrithorn asks Sokunth about the MacBook.
await pool.query(
  `INSERT INTO messages (listing_id, sender_id, receiver_id, content) VALUES
     ($1, $2, $3, 'Hi! Is the MacBook still available?'),
     ($1, $3, $2, 'Yes it is. Want to meet at the library tomorrow?')`,
  [listingIds[1], ids[1], ids[0]],
);

// Chanrithorn saved Sokunth's MacBook, so the Saved page and "Saved by 1 student" have something to show.
await pool.query("INSERT INTO saved_listings (user_id, listing_id) VALUES ($1, $2)", [ids[1], listingIds[1]]);

// Chanrithorn offers $500 for Sokunth's MacBook ($550), so the Offers box has something to show.
await pool.query("INSERT INTO offers (listing_id, buyer_id, amount) VALUES ($1, $2, 500)", [listingIds[1], ids[1]]);

// An auction by Chanrithorn that ends in 3 days, with one opening bid from Sokunth.
const { rows: [auction] } = await pool.query(
  `INSERT INTO listings (user_id, title, description, category, condition, listing_type, price,
                         image_urls, auction_ends_at, min_increment)
   VALUES ($1, 'Study desk (auction)', $3, 'furniture',
           'good', 'auction', 20, $2, now() + interval '3 days', 2)
   RETURNING id`,
  [ids[1], [DESK_PHOTO], "Steel desk with a wooden top and four drawers, very sturdy. Highest bid wins, pick up near AUPP."],
);
await pool.query("INSERT INTO bids (listing_id, bidder_id, amount) VALUES ($1, $2, 22)", [auction.id, ids[0]]);

console.log(`Seeded ${ids.length} users, ${listingIds.length + 1} listings (1 auction), 2 messages, 1 bid, 1 saved listing, 1 offer.`);
await pool.end();
