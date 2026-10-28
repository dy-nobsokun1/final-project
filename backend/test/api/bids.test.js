import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

const api = await startApi();
after(() => api.close());
const { closeEndedAuctions } = await import("../../src/db/auctions.js");

/** A $20 auction ending tomorrow, where each bid must beat the highest by $2. */
function createAuction(owner) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return api.createListing(owner, {
    title: "Test auction", listingType: "auction", price: 20, minIncrement: 2, auctionEndsAt: tomorrow,
  });
}

function bid(user, auction, amount) {
  return api.request("POST", `/api/listings/${auction.id}/bids`, { token: user.token, body: { amount } });
}

test("five people bidding the same amount at the same moment: exactly one bid is accepted", async () => {
  const [seller, ...bidders] = await Promise.all(Array.from({ length: 6 }, () => api.createUser()));
  const auction = await createAuction(seller);

  const results = await Promise.all(bidders.map((bidder) => bid(bidder, auction, 20)));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 400, 400, 400, 400]);
  const { body } = await api.request("GET", `/api/listings/${auction.id}/bids`);
  assert.equal(body.bids.length, 1);
});

test("the seller cannot bid, and every bid must reach the current minimum", async () => {
  const [seller, alice, bob] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const auction = await createAuction(seller);

  assert.equal((await bid(seller, auction, 25)).status, 403);
  assert.equal((await bid(alice, auction, 19)).status, 400, "below the starting price");
  assert.equal((await bid(alice, auction, 20)).status, 201);
  assert.equal((await bid(alice, auction, 30)).status, 400, "already the highest bidder");
  assert.equal((await bid(bob, auction, 21)).status, 400, "must beat $20 by $2");
  assert.equal((await bid(bob, auction, 22)).status, 201);
});

test("once anyone has bid, the seller cannot change the price", async () => {
  const [seller, bidder] = await Promise.all([api.createUser(), api.createUser()]);
  const auction = await createAuction(seller);
  await bid(bidder, auction, 20);
  const change = await api.request("PATCH", `/api/listings/${auction.id}`, { token: seller.token, body: { price: 5 } });
  assert.equal(change.status, 409);
});

test("an ended auction refuses bids and is reserved for the highest bidder", async () => {
  const [seller, alice, bob] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const auction = await createAuction(seller);
  await bid(alice, auction, 20);
  await bid(bob, auction, 22);

  // The API never accepts an end time in the past, so the test moves it there directly.
  await api.sql("UPDATE listings SET auction_ends_at = now() - interval '1 minute' WHERE id = $1", [auction.id]);
  assert.equal((await bid(alice, auction, 30)).status, 400);

  const closed = (await closeEndedAuctions()).find((row) => row.listing_id === auction.id);
  assert.equal(closed.winner_id, bob.id);
  const { body } = await api.request("GET", `/api/listings/${auction.id}`);
  assert.equal(body.listing.status, "reserved");
  assert.equal(body.listing.auction.leadingBidderId, bob.id);
});
