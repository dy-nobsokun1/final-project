import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

const api = await startApi();
after(() => api.close());
// Loaded after startApi() has pointed the app at the test database.
const { markPaid } = await import("../../src/db/payments.js");
const { closeEndedAuctions } = await import("../../src/db/auctions.js");

const stats = async (user) => (await api.request("GET", "/api/users/me/stats", { token: user.token })).body.stats;
const markAs = (owner, listing, status) =>
  api.request("PATCH", `/api/listings/${listing.id}`, { token: owner.token, body: { status } });
const send = (from, to, listing, body) =>
  api.request("POST", "/api/messages", { token: from.token, body: { listingId: listing.id, receiverId: to.id, body } });
// The 10th of the month $2 months back in Cambodian time (as the stats count months), far from any month's end.
const MONTH_AGO_SQL = `(date_trunc('month', now() AT TIME ZONE 'Asia/Phnom_Penh') - make_interval(months => $2)
  + interval '9 days') AT TIME ZONE 'Asia/Phnom_Penh'`;

test("stats need a sign-in", async () => {
  assert.equal((await api.request("GET", "/api/users/me/stats")).status, 401);
});

test("under 3 deals the stats are locked", async () => {
  const seller = await api.createUser("Seller");
  const [first, second] = await Promise.all([api.createListing(seller), api.createListing(seller)]);
  await markAs(seller, first, "sold");
  await markAs(seller, second, "sold");

  const body = await stats(seller);
  assert.equal(body.deals, 2);
  assert.equal(body.unlocked, false);
  assert.equal(body.unlockDeals, 3);
});

test("sales, a trade, a paid purchase, an auction win and an accepted offer add up per month", async () => {
  const [me, cardSeller, auctionSeller, offerSeller, loser] = await Promise.all(
    ["Me", "Card seller", "Auction seller", "Offer seller", "Loser"].map((name) => api.createUser(name)));

  // My own items: one sold in person two months ago, one traded this month with $5 asked on top.
  const book = await api.createListing(me, { price: 30 });
  await markAs(me, book, "sold");
  await api.sql(`UPDATE listings SET sold_at = ${MONTH_AGO_SQL} WHERE id = $1`, [book.id, 2]);
  const desk = await api.createListing(me, { listingType: "trade", price: 0, cashTopup: 5, category: "furniture" });
  await markAs(me, desk, "traded");

  // Bought online: paid last month, though the listing only changed this month.
  const phone = await api.createListing(cardSeller, { price: 25, category: "electronics" });
  const [payment] = await api.sql(
    "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, 25, $3) RETURNING id",
    [phone.id, me.id, `cs_test_${phone.id}`],
  );
  await markPaid(payment.id);
  await api.sql(`UPDATE payments SET paid_at = ${MONTH_AGO_SQL} WHERE id = $1`, [payment.id, 1]);

  // Won an auction at $12 (the loser bid $10), then the seller marked it sold.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const bike = await api.createListing(auctionSeller, { listingType: "auction", price: 10, auctionEndsAt: tomorrow, category: "bikes" });
  const bid = (user, amount) => api.request("POST", `/api/listings/${bike.id}/bids`, { token: user.token, body: { amount } });
  assert.equal((await bid(loser, 10)).status, 201);
  assert.equal((await bid(me, 12)).status, 201);
  await api.sql("UPDATE listings SET auction_ends_at = now() - interval '1 minute' WHERE id = $1", [bike.id]);
  await closeEndedAuctions();
  await markAs(auctionSeller, bike, "sold");

  // An accepted $32 offer on a $40 jacket, handed over in person.
  const jacket = await api.createListing(offerSeller, { price: 40, category: "clothing" });
  const offer = await api.request("POST", `/api/listings/${jacket.id}/offers`, { token: me.token, body: { amount: 32 } });
  assert.equal((await api.request("POST", `/api/offers/${offer.body.offer.id}/accept`, { token: offerSeller.token })).status, 200);
  await markAs(offerSeller, jacket, "sold");

  const body = await stats(me);
  assert.deepEqual(
    { deals: body.deals, sales: body.sales, trades: body.trades, purchases: body.purchases, unlocked: body.unlocked },
    { deals: 5, sales: 1, trades: 1, purchases: 3, unlocked: true },
  );
  assert.equal(body.earned, 35);
  assert.equal(body.spent, 69);
  assert.equal(body.soldListings, 2);
  assert.equal(body.months.length, 6);
  assert.deepEqual(body.months.map((month) => [month.earned, month.spent]),
    [[0, 0], [0, 0], [0, 0], [30, 0], [0, 25], [5, 44]]);
  assert.deepEqual(body.soldByCategory, [{ category: "furniture", count: 1 }, { category: "textbooks", count: 1 }]);
  assert.deepEqual(body.boughtByCategory.map((row) => row.category), ["bikes", "clothing", "electronics"]);
  assert.doesNotMatch(JSON.stringify(body), /@/, "no emails in the stats");

  // The other side of each deal: the paid amount, the winning bid, the agreed price.
  assert.equal((await stats(cardSeller)).earned, 25);
  assert.equal((await stats(auctionSeller)).earned, 12);
  assert.equal((await stats(offerSeller)).earned, 32);
  assert.equal((await stats(loser)).deals, 0, "outbid, so not a purchase");
});

test("chatting both ways about an item sold in person is not a purchase", async () => {
  const [owner, chatter] = await Promise.all([api.createUser("Owner"), api.createUser("Chatter")]);
  const listing = await api.createListing(owner);
  await send(chatter, owner, listing, "Still available?");
  await send(owner, chatter, listing, "Yes, meet at 2pm?");
  await markAs(owner, listing, "sold");

  assert.equal((await stats(chatter)).deals, 0);
  assert.equal((await stats(owner)).sales, 1);
});

test("sold_at is set when an item is sold, kept on later edits and cleared when it is available again", async () => {
  const owner = await api.createUser("Owner");
  const listing = await api.createListing(owner);
  const soldAt = async () => (await api.sql("SELECT sold_at FROM listings WHERE id = $1", [listing.id]))[0].sold_at;
  assert.equal(await soldAt(), null);

  await markAs(owner, listing, "sold");
  const first = await soldAt();
  assert.ok(first instanceof Date);
  await api.request("PATCH", `/api/listings/${listing.id}`, { token: owner.token, body: { title: "Renamed after the sale" } });
  await markAs(owner, listing, "sold");
  assert.deepEqual(await soldAt(), first, "a new title, or sold again, is not a new sale");

  await markAs(owner, listing, "active");
  assert.equal(await soldAt(), null);
});
