import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi, waitFor } from "./helpers.js";

// KHQR is switched on for this file, with Bakong replaced by the same fake as in khqr.test.js (minus
// its "down" switch, which no test here needs): requests to its API get "paid" for the MD5s in
// `paidMd5s` and "not found" for everything else. All other requests (the tests calling our API) go
// through as normal.
const realFetch = globalThis.fetch;
const paidMd5s = new Set();
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith("https://api-bakong.nbc.gov.kh/")) return realFetch(url, options);
  const { md5 } = JSON.parse(options.body);
  return Response.json(paidMd5s.has(md5)
    ? { responseCode: 0, data: { hash: "test" } }
    : { responseCode: 1, errorCode: 1, responseMessage: "Transaction could not be found." });
};

const api = await startApi({ env: { BAKONG_TOKEN: "test-token" } });
after(() => api.close());
const { khqrMd5 } = await import("../../src/utils/khqr.js");
const { markPaid } = await import("../../src/db/payments.js");

const offer = (user, listing, amount) =>
  api.request("POST", `/api/listings/${listing.id}/offers`, { token: user?.token, body: { amount } });
const answer = (user, offerId, step) => api.request("POST", `/api/offers/${offerId}/${step}`, { token: user.token });
const myOffer = async (user, listing) =>
  (await api.request("GET", `/api/listings/${listing.id}/offers/mine`, { token: user.token })).body.offer;
const sellerOffers = (user, listing) => api.request("GET", `/api/listings/${listing.id}/offers`, { token: user?.token });
const patch = (owner, listing, body) => api.request("PATCH", `/api/listings/${listing.id}`, { token: owner.token, body });
const getListing = async (listing) => (await api.request("GET", `/api/listings/${listing.id}`)).body.listing;
const reservedFor = async (listing) =>
  (await api.sql("SELECT reserved_for FROM listings WHERE id = $1", [listing.id]))[0].reserved_for;
const offerStatus = async (id) => (await api.sql("SELECT status FROM offers WHERE id = $1", [id]))[0].status;

const startKhqr = (user, listing) => api.request("POST", "/api/payments/khqr", {
  token: user.token,
  body: { listingId: listing.id },
});
const khqrStatus = (user, paymentId) => api.request("GET", `/api/payments/khqr/${paymentId}`, { token: user.token });

/** A seller who added a Bakong account, so buyers can pay their items by KHQR. */
async function sellerWithBakong() {
  const seller = await api.createUser("Seller");
  await api.request("PATCH", "/api/users/me", { token: seller.token, body: { bakongAccountId: "seller@aclb" } });
  return seller;
}

/** Whether the app would have emailed `user` a notification whose subject contains `text`. */
const emailed = (user, text) =>
  api.skippedEmails().some((line) => line.endsWith(` to ${user.email}`) && line.includes(text));

test("an offer must be below the asking price, on someone else's available item for sale", async () => {
  const [seller, buyer] = await Promise.all([api.createUser("Seller"), api.createUser("Buyer")]);
  const listing = await api.createListing(seller); // $25

  assert.equal((await offer(null, listing, 20)).status, 401);
  for (const amount of [0, -5, "20", 25, 30, 24.999]) {
    assert.equal((await offer(buyer, listing, amount)).status, 400, `amount ${amount}`);
  }
  assert.equal((await offer(seller, listing, 20)).status, 403);

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const others = await Promise.all([
    api.createListing(seller, { listingType: "giveaway", price: 0 }),
    api.createListing(seller, { listingType: "trade", price: 0 }),
    api.createListing(seller, { title: "Qwyzzle offer-test wanted post", listingType: "buy_request", price: 30 }),
    api.createListing(seller, { listingType: "auction", price: 10, auctionEndsAt: tomorrow }),
  ]);
  for (const other of others) assert.equal((await offer(buyer, other, 5)).status, 400, other.listingType);
  const sold = await api.createListing(seller);
  await patch(seller, sold, { status: "sold" });
  assert.equal((await offer(buyer, sold, 20)).status, 400);

  const made = await offer(buyer, listing, 20);
  assert.equal(made.status, 201);
  assert.equal(made.body.offer.amount, 20);
  assert.equal(made.body.offer.status, "pending");
  assert.equal(made.body.offer.buyer.id, buyer.id);
  assert.equal(JSON.stringify(made.body).includes("email"), false);
  await waitFor(() => emailed(seller, "Buyer offered $20 for"));

  // Once the seller lowers the price to the offer or below, the buyer can simply pay it.
  await patch(seller, listing, { price: 20 });
  const tooHigh = await answer(seller, made.body.offer.id, "accept");
  assert.equal(tooHigh.status, 409);
  assert.match(tooHigh.body.error, /Decline this offer instead/);
});

test("the seller sees the open offers, highest first, with the buyer's public info; nobody else does", async () => {
  const [seller, a, b, stranger] = await Promise.all([
    api.createUser("Seller"), api.createUser("Buyer A"), api.createUser("Buyer B"), api.createUser("Stranger"),
  ]);
  const listing = await api.createListing(seller);
  await offer(a, listing, 18);
  await offer(b, listing, 20);

  const list = await sellerOffers(seller, listing);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.offers.map((item) => [item.amount, item.buyer.name]), [[20, "Buyer B"], [18, "Buyer A"]]);
  assert.equal(JSON.stringify(list.body).includes("email"), false);
  assert.equal((await sellerOffers(a, listing)).status, 403);
  assert.equal((await sellerOffers(null, listing)).status, 401);

  assert.equal((await myOffer(a, listing)).amount, 18);
  assert.equal((await myOffer(b, listing)).amount, 20);
  assert.equal(await myOffer(stranger, listing), null);
  const publicListing = await getListing(listing);
  assert.equal("agreedPrice" in publicListing, false);
  assert.equal("reservedFor" in publicListing, false);
});

test("a new offer replaces the buyer's pending one, so an old amount can never be accepted", async () => {
  const [seller, a] = await Promise.all([api.createUser("Seller"), api.createUser("Buyer A")]);
  const listing = await api.createListing(seller);
  const first = (await offer(a, listing, 15)).body.offer;
  const second = (await offer(a, listing, 18)).body.offer;

  assert.deepEqual((await sellerOffers(seller, listing)).body.offers.map((item) => item.amount), [18]);
  assert.equal(await offerStatus(first.id), "withdrawn");
  assert.equal((await answer(seller, first.id, "accept")).status, 409);
  assert.equal((await answer(seller, second.id, "accept")).status, 200);
});

test("a buyer can withdraw a pending offer, and only their own", async () => {
  const [seller, a, b] = await Promise.all([api.createUser("Seller"), api.createUser("Buyer A"), api.createUser("Buyer B")]);
  const listing = await api.createListing(seller);
  const made = (await offer(a, listing, 20)).body.offer;

  assert.equal((await answer(b, made.id, "withdraw")).status, 403);
  assert.equal((await answer(seller, made.id, "withdraw")).status, 403);
  const withdrawn = await answer(a, made.id, "withdraw");
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.offer.status, "withdrawn");
  assert.equal((await answer(a, made.id, "withdraw")).status, 409);
  assert.equal((await answer(seller, made.id, "accept")).status, 409);
  assert.deepEqual((await sellerOffers(seller, listing)).body.offers, []);
  assert.equal((await offer(a, listing, 20)).status, 201);
});

test("accepting reserves the item for that buyer at their price and declines the other offers", async () => {
  const [seller, a, b, c] = await Promise.all([
    api.createUser("Seller"), api.createUser("Buyer A"), api.createUser("Buyer B"), api.createUser("Buyer C"),
  ]);
  const listing = await api.createListing(seller); // $25
  const fromA = (await offer(a, listing, 18)).body.offer;
  const fromB = (await offer(b, listing, 20)).body.offer;
  await offer(c, listing, 15);

  assert.equal((await answer(a, fromA.id, "accept")).status, 403);
  const accepted = await answer(seller, fromA.id, "accept");
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.offer.status, "accepted");
  assert.equal((await getListing(listing)).status, "reserved");
  assert.equal(await reservedFor(listing), a.id);
  assert.equal((await myOffer(b, listing)).status, "declined");
  assert.equal((await myOffer(c, listing)).status, "declined");
  assert.equal((await offer(b, listing, 21)).status, 400);
  assert.equal((await answer(seller, fromB.id, "accept")).status, 409);
  assert.deepEqual((await sellerOffers(seller, listing)).body.offers.map((item) => [item.buyer.id, item.status]),
    [[a.id, "accepted"]]);

  await waitFor(() => emailed(a, "accepted your offer")
    && emailed(b, "was declined") && emailed(c, "was declined"));
});

test("two offers accepted at the same moment: exactly one wins", async () => {
  const [seller, a, b] = await Promise.all([api.createUser("Seller"), api.createUser("Buyer A"), api.createUser("Buyer B")]);
  const listing = await api.createListing(seller);
  const fromA = (await offer(a, listing, 18)).body.offer;
  const fromB = (await offer(b, listing, 20)).body.offer;

  const results = await Promise.all([answer(seller, fromA.id, "accept"), answer(seller, fromB.id, "accept")]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const accepted = await api.sql("SELECT buyer_id FROM offers WHERE listing_id = $1 AND status = 'accepted'", [listing.id]);
  assert.equal(accepted.length, 1);
  assert.equal(await reservedFor(listing), accepted[0].buyer_id);
});

test("only the reserved buyer can pay, at the agreed price; paying by KHQR marks the item sold to them", async () => {
  const [seller, a, b] = await Promise.all([sellerWithBakong(), api.createUser("Buyer A"), api.createUser("Buyer B")]);
  const listing = await api.createListing(seller); // $25
  const made = (await offer(a, listing, 17.5)).body.offer;
  await answer(seller, made.id, "accept");

  assert.equal((await startKhqr(b, listing)).status, 403);
  const started = await startKhqr(a, listing);
  assert.equal(started.status, 201);
  assert.equal(started.body.amount, 17.5);
  assert.match(started.body.qr, /540517\.50/);

  paidMd5s.add(khqrMd5(started.body.qr)); // A pays in their banking app
  assert.deepEqual((await khqrStatus(a, started.body.paymentId)).body, { status: "paid" });
  assert.equal((await getListing(listing)).status, "sold");
  assert.equal(await reservedFor(listing), a.id);
  assert.equal(await offerStatus(made.id), "accepted");
  const canReview = await api.request("GET", `/api/listings/${listing.id}/reviews/can-review?revieweeId=${seller.id}`, { token: a.token });
  assert.equal(canReview.body.allowed, true);
});

test("accepting is refused while another buyer is paying, but not while the offer's own buyer is", async () => {
  const [seller, a, b] = await Promise.all([sellerWithBakong(), api.createUser("Buyer A"), api.createUser("Buyer B")]);

  const first = await api.createListing(seller);
  const fromA = (await offer(a, first, 20)).body.offer;
  const paying = await startKhqr(b, first);
  assert.equal(paying.status, 201);
  const refused = await answer(seller, fromA.id, "accept");
  assert.equal(refused.status, 409);
  assert.match(refused.body.error, /paying/);
  // B's QR expires unpaid (the fake Bakong has not seen it paid): accepting now works.
  await api.sql("UPDATE payments SET created_at = now() - interval '31 minutes' WHERE id = $1", [paying.body.paymentId]);
  assert.equal((await answer(seller, fromA.id, "accept")).status, 200);

  const second = await api.createListing(seller);
  assert.equal((await startKhqr(a, second)).status, 201); // A started paying the full price, then offered less
  const again = (await offer(a, second, 20)).body.offer;
  assert.equal((await answer(seller, again.id, "accept")).status, 200);
});

test("someone else's payment for an item reserved by an offer becomes refund_due, and their QR is withdrawn", async () => {
  const [seller, a, b, c] = await Promise.all([
    sellerWithBakong(), api.createUser("Buyer A"), api.createUser("Buyer B"), api.createUser("Buyer C"),
  ]);
  const listing = await api.createListing(seller);
  const fromB = (await startKhqr(b, listing)).body;
  await api.sql("UPDATE payments SET created_at = now() - interval '31 minutes' WHERE id = $1", [fromB.paymentId]);
  const made = (await offer(a, listing, 20)).body.offer;
  assert.equal((await answer(seller, made.id, "accept")).status, 200);

  assert.deepEqual((await khqrStatus(b, fromB.paymentId)).body, { status: "unavailable" });
  paidMd5s.add(khqrMd5(fromB.qr)); // B pays the old QR anyway
  assert.deepEqual((await khqrStatus(b, fromB.paymentId)).body, { status: "refund_due" });
  assert.equal((await getListing(listing)).status, "reserved");
  assert.equal(await reservedFor(listing), a.id);
  const fromA = await startKhqr(a, listing);
  assert.equal(fromA.status, 201);
  assert.equal(fromA.body.amount, 20);

  // The same for a card payment confirmed late (a Stripe-style row; Stripe itself is off in tests).
  const [{ id }] = await api.sql(
    "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, 25, $3) RETURNING id",
    [listing.id, c.id, `cs_test_${made.id}`],
  );
  assert.equal((await markPaid(id)).status, "refund_due");
});

test("declining tells the buyer the item is still available, and they can offer again", async () => {
  const [seller, a, stranger] = await Promise.all([api.createUser("Seller"), api.createUser("Buyer A"), api.createUser("Stranger")]);
  const listing = await api.createListing(seller);
  const made = (await offer(a, listing, 20)).body.offer;

  assert.equal((await answer(a, made.id, "decline")).status, 403);
  assert.equal((await answer(stranger, made.id, "decline")).status, 403);
  const declined = await answer(seller, made.id, "decline");
  assert.equal(declined.status, 200);
  assert.equal(declined.body.offer.status, "declined");
  assert.equal((await myOffer(a, listing)).status, "declined");
  assert.equal((await getListing(listing)).status, "active");
  assert.equal((await answer(seller, made.id, "decline")).status, 409);
  await waitFor(() => emailed(a, "was declined"));

  const again = await offer(a, listing, 21);
  assert.equal(again.status, 201);
  assert.equal(again.body.offer.status, "pending");
});

test("making the item available again cancels the accepted offer, and the buyer pays the asking price again", async () => {
  const [seller, a, b] = await Promise.all([sellerWithBakong(), api.createUser("Buyer A"), api.createUser("Buyer B")]);
  const listing = await api.createListing(seller); // $25
  const made = (await offer(a, listing, 20)).body.offer;
  await answer(seller, made.id, "accept");

  assert.equal((await patch(seller, listing, { status: "active" })).status, 200);
  assert.equal(await reservedFor(listing), null);
  assert.equal((await myOffer(a, listing)).status, "cancelled");
  assert.deepEqual((await sellerOffers(seller, listing)).body.offers, []);
  await waitFor(() => emailed(a, "is no longer reserved for you"));
  assert.equal((await offer(b, listing, 22)).status, 201);
  const paying = await startKhqr(a, listing);
  assert.equal(paying.status, 201);
  assert.equal(paying.body.amount, 25);
});

test("marking the item sold keeps the offer's buyer, so they and the owner can review each other", async () => {
  const [seller, a, b] = await Promise.all([api.createUser("Seller"), api.createUser("Buyer A"), api.createUser("Buyer B")]);
  const listing = await api.createListing(seller);
  const send = (from, to, body) =>
    api.request("POST", "/api/messages", { token: from.token, body: { listingId: listing.id, receiverId: to.id, body } });
  // B chatted with the seller both ways, which would count for an in-person deal without an offer.
  await send(b, seller, "Is it still available?");
  await send(seller, b, "Yes!");
  const made = (await offer(a, listing, 20)).body.offer;
  await answer(seller, made.id, "accept");

  assert.equal((await patch(seller, listing, { status: "sold" })).status, 200);
  assert.equal(await reservedFor(listing), a.id);
  const canReview = async (user) => (await api.request("GET",
    `/api/listings/${listing.id}/reviews/can-review?revieweeId=${seller.id}`, { token: user.token })).body.allowed;
  assert.equal(await canReview(a), true);
  assert.equal(await canReview(b), false);
  const review = (from, about) => api.request("POST", `/api/listings/${listing.id}/reviews`, {
    token: from.token,
    body: { revieweeId: about.id, rating: 5 },
  });
  assert.equal((await review(a, seller)).status, 201);
  assert.equal((await review(seller, a)).status, 201);
  assert.equal((await review(b, seller)).status, 403);
});

test("pending offers are declined when the item is reserved, sold or paid for another way", async () => {
  const [a, b] = await Promise.all([api.createUser("Buyer A"), api.createUser("Buyer B")]);

  const seller = await api.createUser("Seller");
  const first = await api.createListing(seller);
  await offer(a, first, 20);
  await patch(seller, first, { status: "reserved" });
  assert.equal((await myOffer(a, first)).status, "declined");
  await patch(seller, first, { status: "active" });
  assert.equal((await myOffer(a, first)).status, "declined");
  assert.equal((await offer(a, first, 20)).status, 201);

  const khqrSeller = await sellerWithBakong();
  const second = await api.createListing(khqrSeller);
  await offer(a, second, 20);
  const paying = (await startKhqr(b, second)).body; // B pays the full price
  paidMd5s.add(khqrMd5(paying.qr));
  assert.deepEqual((await khqrStatus(b, paying.paymentId)).body, { status: "paid" });
  assert.equal((await myOffer(a, second)).status, "declined");
});

test("while reserved by an offer, the item's type is locked and it cannot be deleted", async () => {
  const [seller, a] = await Promise.all([sellerWithBakong(), api.createUser("Buyer A")]);
  const listing = await api.createListing(seller); // $25
  const made = (await offer(a, listing, 20)).body.offer;
  await answer(seller, made.id, "accept");

  assert.equal((await patch(seller, listing, { listingType: "trade" })).status, 409);
  assert.equal((await patch(seller, listing, { listingType: "sale", description: "x" })).status, 200);
  assert.equal((await patch(seller, listing, { price: 30 })).status, 200);
  const paying = await startKhqr(a, listing);
  assert.equal(paying.body.amount, 20); // the agreed price, not the new asking price

  const deleteListing = () => api.request("DELETE", `/api/listings/${listing.id}`, { token: seller.token });
  const refused = await deleteListing();
  assert.equal(refused.status, 409);
  assert.match(refused.body.error, /Make it available again/);
  assert.equal((await patch(seller, listing, { status: "active" })).status, 200);
  // A's QR was never paid: aged past the 24 hours a payment may still be confirmed, so it no longer blocks deleting.
  await api.sql("UPDATE payments SET created_at = now() - interval '25 hours' WHERE id = $1", [paying.body.paymentId]);
  assert.equal((await deleteListing()).status, 204);
  assert.deepEqual(await api.sql("SELECT id FROM offers WHERE listing_id = $1", [listing.id]), []);
});
