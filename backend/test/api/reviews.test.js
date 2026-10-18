import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

const api = await startApi();
after(() => api.close());

function send(from, to, listing, body) {
  return api.request("POST", "/api/messages", {
    token: from.token,
    body: { listingId: listing.id, receiverId: to.id, body },
  });
}

function review(from, listing, about, rating, comment) {
  return api.request("POST", `/api/listings/${listing.id}/reviews`, {
    token: from?.token,
    body: { revieweeId: about.id, rating, comment },
  });
}

/** An owner and a buyer who wrote to each other about a listing, now marked sold. */
async function finishedDeal(owner) {
  owner ??= await api.createUser("Owner");
  const buyer = await api.createUser("Buyer");
  const listing = await api.createListing(owner);
  await send(buyer, owner, listing, "I'll take it!");
  await send(owner, buyer, listing, "Great, see you at the library at 3.");
  await api.request("PATCH", `/api/listings/${listing.id}`, { token: owner.token, body: { status: "sold" } });
  return { owner, buyer, listing };
}

test("after a sale, the owner and the buyer can review each other, once each", async () => {
  const { owner, buyer, listing } = await finishedDeal();
  const first = await review(buyer, listing, owner, 5, "On time and friendly");
  assert.equal(first.status, 201);
  assert.equal(first.body.review.reviewer.id, buyer.id);
  assert.equal((await review(owner, listing, buyer, 4)).status, 201);
  assert.equal((await review(buyer, listing, owner, 1)).status, 409, "a second review of the same deal");

  const { body } = await api.request("GET", `/api/users/${owner.id}/reviews`);
  assert.equal(body.reviewCount, 1);
  assert.equal(body.reviews[0].comment, "On time and friendly");
  assert.equal(body.reviews[0].listingTitle, listing.title);
});

test("a profile's average covers every review the user received", async () => {
  const first = await finishedDeal();
  const second = await finishedDeal(first.owner);
  await review(first.buyer, first.listing, first.owner, 5);
  await review(second.buyer, second.listing, first.owner, 4);
  const { body } = await api.request("GET", `/api/users/${first.owner.id}/reviews`);
  assert.deepEqual([body.reviewCount, body.averageRating], [2, 4.5]);
});

test("no review until the listing is marked sold or traded", async () => {
  const [owner, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  await send(buyer, owner, listing, "Still available?");
  await send(owner, buyer, listing, "Yes!");
  assert.equal((await review(buyer, listing, owner, 5)).status, 400);
});

test("only people who wrote to each other about the listing can review", async () => {
  const { owner, buyer, listing } = await finishedDeal();
  const [asker, stranger] = await Promise.all([api.createUser(), api.createUser()]);
  await send(asker, owner, listing, "Is it still available?"); // never answered

  assert.equal((await review(asker, listing, owner, 1)).status, 403, "one-way message");
  assert.equal((await review(owner, listing, asker, 1)).status, 403, "owner rating someone who got no reply");
  assert.equal((await review(stranger, listing, owner, 1)).status, 403, "never wrote at all");
  assert.equal((await review(stranger, listing, buyer, 1)).status, 403, "neither of them is the owner");
});

test("a review needs a login, a 1-5 rating, and someone other than yourself", async () => {
  const { owner, buyer, listing } = await finishedDeal();
  assert.equal((await review(null, listing, owner, 5)).status, 401);
  assert.equal((await review(buyer, listing, owner, 6)).status, 400);
  assert.equal((await review(buyer, listing, owner, 4.5)).status, 400);
  assert.equal((await review(owner, listing, owner, 5)).status, 400);
});

test("a listing's reviews are public, showing the reviewer's name but never an email", async () => {
  const { owner, buyer, listing } = await finishedDeal();
  await review(buyer, listing, owner, 5, "Great seller");
  const { body } = await api.request("GET", `/api/listings/${listing.id}/reviews`);
  assert.deepEqual(body.reviews.map((item) => [item.reviewer.name, item.rating]), [["Buyer", 5]]);
  assert.equal(JSON.stringify(body).includes(buyer.email), false);
});

// Loaded after startApi() has pointed the app at the test database.
const { markPaid } = await import("../../src/db/payments.js");
const { closeEndedAuctions } = await import("../../src/db/auctions.js");

function canReview(from, listing, about) {
  return api.request("GET", `/api/listings/${listing.id}/reviews/can-review?revieweeId=${about.id}`, { token: from.token });
}

test("when someone paid online, only that buyer and the owner can review each other", async () => {
  const [owner, payer, asker] = await Promise.all([api.createUser("Owner"), api.createUser("Payer"), api.createUser("Asker")]);
  const listing = await api.createListing(owner);
  // The asker chats with the owner both ways, but someone else pays.
  await send(asker, owner, listing, "Is it still available?");
  await send(owner, asker, listing, "Yes, for now!");
  const [payment] = await api.sql(
    "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, 25, $3) RETURNING id",
    [listing.id, payer.id, `cs_test_${listing.id}`],
  );
  await markPaid(payment.id);

  assert.deepEqual((await canReview(payer, listing, owner)).body, { allowed: true, reason: null });
  assert.equal((await canReview(asker, listing, owner)).body.allowed, false);
  assert.equal((await review(asker, listing, owner, 1)).status, 403, "chatted, but did not buy");
  assert.equal((await review(owner, listing, asker, 1)).status, 403, "owner rating someone who did not buy");
  assert.equal((await review(payer, listing, owner, 5)).status, 201, "paid without chatting first");
  assert.equal((await review(owner, listing, payer, 5)).status, 201);
});

test("after an auction, the winner and the owner can review each other, other bidders cannot", async () => {
  const [owner, winner, loser] = await Promise.all([api.createUser("Owner"), api.createUser("Winner"), api.createUser("Loser")]);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const auction = await api.createListing(owner, { listingType: "auction", price: 10, auctionEndsAt: tomorrow });
  const bid = (user, amount) => api.request("POST", `/api/listings/${auction.id}/bids`, { token: user.token, body: { amount } });
  assert.equal((await bid(loser, 10)).status, 201);
  assert.equal((await bid(winner, 12)).status, 201);
  await send(loser, owner, auction, "Can I see it before bidding more?");
  await send(owner, loser, auction, "Sure, come by tomorrow.");
  await api.sql("UPDATE listings SET auction_ends_at = now() - interval '1 minute' WHERE id = $1", [auction.id]);
  await closeEndedAuctions();
  await api.request("PATCH", `/api/listings/${auction.id}`, { token: owner.token, body: { status: "sold" } });

  assert.equal((await review(loser, auction, owner, 1)).status, 403, "outbid, even though they chatted");
  assert.equal((await review(winner, auction, owner, 5)).status, 201, "won, without chatting first");
  assert.equal((await review(owner, auction, winner, 5)).status, 201);
});
