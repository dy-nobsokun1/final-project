// Gives the demo student chanrithorn@aupp.edu.kh 9 finished deals over the last 11 weeks, so the
// "Your stats" charts on their profile have something to show in a demo. Needs the demo accounts
// (chanrithorn from db:seed, the @demo.edu.kh sellers from db:samples). Safe to re-run.
//   npm run db:demo-deals                 add them
//   npm run db:demo-deals -- --remove     delete exactly the listings below (their bids, offers and payments go with them)
// Demo data only. Written straight to the database: no Stripe or Bakong calls, no emails, no Telegram.
// The card payments are made-up "paid" rows (stripe_session_id "cs_demo_…"), not real Stripe sessions.
import { pool, withTransaction } from "../src/db/pool.js";

const ME = "chanrithorn@aupp.edu.kh";
const DAY = 24 * 60 * 60 * 1000;

// Each deal is a new listing. `paidBy`: a paid card payment. `bids`: an auction, lowest bid first,
// so the last bidder won. `offer`: [buyer, amount], accepted, so the item was reserved for them.
// No buyer at all: handed over in person, which counts as a sale but as nobody's purchase.
const DEALS = [
  // Chanrithorn's own items (6): earned $22 + $12 + $35 + $24 + $20 + $10 = $123.
  { owner: ME, title: "Principles of Marketing textbook", category: "textbooks", price: 22, daysAgo: 75,
    paidBy: "pisey@demo.edu.kh", description: "4th edition, a few highlighted pages." },
  { owner: ME, title: "Wireless mouse", category: "electronics", price: 12, daysAgo: 58,
    description: "Works fine, battery included." },
  { owner: ME, title: "Bluetooth speaker", category: "electronics", price: 35, daysAgo: 50,
    paidBy: "sophea@demo.edu.kh", description: "Loud enough for a dorm room, charges by USB-C." },
  { owner: ME, title: "Graphing calculator (auction)", category: "electronics", price: 15, daysAgo: 36,
    bids: [["rithy@demo.edu.kh", 18], ["bopha@demo.edu.kh", 24]], description: "Allowed in most exams." },
  { owner: ME, title: "Small bookshelf", category: "furniture", price: 25, daysAgo: 22,
    offer: ["sreyneang@demo.edu.kh", 20], description: "Three shelves, fits beside a desk." },
  { owner: ME, title: "Acoustic guitar - trade for a bike lock", category: "other", type: "trade", cashTopup: 10,
    daysAgo: 12, description: "Swapped for a bike lock plus $10." },
  // Bought from the demo sellers (3): spent $15 + $45 + $26 = $86.
  { owner: "vannak@demo.edu.kh", title: "Grey hoodie (size M)", category: "clothing", price: 15, daysAgo: 55,
    paidBy: ME, description: "Worn a few times." },
  { owner: "rithy@demo.edu.kh", title: "Road bike (auction)", category: "bikes", price: 35, daysAgo: 18,
    bids: [["pisey@demo.edu.kh", 40], [ME, 45]], description: "New tyres last semester." },
  { owner: "sophea@demo.edu.kh", title: "Desk chair", category: "furniture", price: 30, daysAgo: 8,
    offer: [ME, 26], description: "Adjustable height." },
];

if (process.argv.includes("--remove")) {
  // Only these owner + title pairs. ON DELETE CASCADE removes their bids, offers and payments too.
  const { rowCount } = await pool.query(
    `DELETE FROM listings l USING users u, unnest($1::text[], $2::text[]) AS demo(email, title)
     WHERE u.id = l.user_id AND u.email = demo.email AND l.title = demo.title`,
    [DEALS.map((deal) => deal.owner), DEALS.map((deal) => deal.title)],
  );
  console.log(`Removed ${rowCount} demo deals.`);
  await pool.end();
  process.exit(0);
}

const emails = [...new Set(DEALS.flatMap((deal) =>
  [deal.owner, deal.paidBy, deal.offer?.[0], ...(deal.bids ?? []).map(([bidder]) => bidder)]).filter(Boolean))];
const { rows: users } = await pool.query("SELECT id, email FROM users WHERE email = ANY($1)", [emails]);
const ids = Object.fromEntries(users.map((user) => [user.email, user.id]));
const missing = emails.filter((email) => !ids[email]);
if (missing.length) {
  console.error(`Missing demo accounts: ${missing.join(", ")}. They come from db:seed and db:samples.`);
  await pool.end();
  process.exit(1);
}

const added = await withTransaction(async (client) => {
  let count = 0;
  for (const deal of DEALS) {
    const dealAt = new Date(Date.now() - deal.daysAgo * DAY);
    const postedAt = new Date(dealAt.getTime() - 6 * DAY);
    const type = deal.type ?? (deal.bids ? "auction" : "sale");
    const reservedFor = deal.offer ? ids[deal.offer[0]] : null;
    // sold_at is when it was sold (profile stats use it when nothing was paid online). Skipped if an
    // earlier run already added it.
    const { rows: [listing] } = await client.query(
      `INSERT INTO listings (user_id, title, description, category, condition, listing_type, price, cash_topup,
                             auction_ends_at, status, reserved_for, created_at, updated_at, sold_at)
       SELECT $1::uuid, $2::text, $3, $4, 'good', $5, $6::numeric, $7::numeric, $8::timestamptz, $9,
              $10::uuid, $11::timestamptz, $12::timestamptz, $12::timestamptz
       WHERE NOT EXISTS (SELECT 1 FROM listings WHERE user_id = $1::uuid AND title = $2::text)
       RETURNING id`,
      [ids[deal.owner], deal.title, deal.description, deal.category, type, deal.price ?? 0, deal.cashTopup ?? null,
        type === "auction" ? dealAt : null, type === "trade" ? "traded" : "sold", reservedFor, postedAt, dealAt],
    );
    if (!listing) continue;
    count += 1;

    for (const [index, [bidder, amount]] of (deal.bids ?? []).entries()) {
      await client.query("INSERT INTO bids (listing_id, bidder_id, amount, created_at) VALUES ($1, $2, $3, $4)",
        [listing.id, ids[bidder], amount, new Date(postedAt.getTime() + (index + 1) * DAY)]);
    }
    if (deal.offer) {
      await client.query(
        `INSERT INTO offers (listing_id, buyer_id, amount, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'accepted', $4, $4)`,
        [listing.id, reservedFor, deal.offer[1], new Date(postedAt.getTime() + DAY)],
      );
    }
    if (deal.paidBy) {
      await client.query(
        `INSERT INTO payments (listing_id, buyer_id, amount, method, stripe_session_id, status, created_at, paid_at)
         VALUES ($1, $2, $3, 'stripe', $4, 'paid', $5, $5)`,
        [listing.id, ids[deal.paidBy], deal.price, `cs_demo_${listing.id}`, dealAt],
      );
    }
  }
  return count;
});

console.log(`Added ${added} demo deals (${DEALS.length - added} were already there). Log in as ${ME} `
  + `(password "password123") and open your profile to see the stats.`);
await pool.end();
