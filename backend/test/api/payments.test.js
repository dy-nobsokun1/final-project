import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

// Stripe itself is switched off in tests, so these check our side of the payment flow.
const api = await startApi();
after(() => api.close());
const { markPaid } = await import("../../src/db/payments.js");

test("with Stripe switched off, the pay button is hidden and checkout is refused", async () => {
  const [seller, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(seller);
  assert.deepEqual((await api.request("GET", "/api/payments/config")).body, { enabled: false, khqr: false });
  const checkout = await api.request("POST", "/api/payments/checkout", {
    token: buyer.token,
    body: { listingId: listing.id },
  });
  assert.equal(checkout.status, 503);
});

test("a paid checkout marks the listing sold exactly once, and only its buyer can confirm it", async () => {
  const [seller, buyer, stranger] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const listing = await api.createListing(seller);
  // What /checkout saves before sending the buyer to Stripe's page.
  const [payment] = await api.sql(
    "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, 25, 'cs_test_once') RETURNING id",
    [listing.id, buyer.id],
  );

  // The return page and Stripe's webhook may both report the same payment: only the first counts.
  assert.equal((await markPaid(payment.id)).buyer_id, buyer.id);
  assert.equal(await markPaid(payment.id), null);
  assert.equal((await api.request("GET", `/api/listings/${listing.id}`)).body.listing.status, "sold");

  const confirm = (user) => api.request("POST", "/api/payments/confirm", {
    token: user.token,
    body: { sessionId: "cs_test_once" },
  });
  assert.deepEqual((await confirm(buyer)).body, { status: "paid" });
  assert.equal((await confirm(stranger)).status, 404);
});

test("the Stripe webhook is refused while it is not set up", async () => {
  const response = await api.request("POST", "/api/payments/webhook", { body: { type: "checkout.session.completed" } });
  assert.equal(response.status, 503);
});

/** A Stripe payment row as /checkout saves it, waiting for Stripe to report it paid. */
async function pendingPayment(listing, buyer) {
  const [row] = await api.sql(
    "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, 25, $3) RETURNING id",
    [listing.id, buyer.id, `cs_test_${buyer.id}`],
  );
  return row.id;
}

test("a payment that arrives after the item was sold is recorded as refund_due, not as a second sale", async () => {
  const [seller, first, late] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const listing = await api.createListing(seller);
  const [firstPayment, latePayment] = [await pendingPayment(listing, first), await pendingPayment(listing, late)];

  assert.equal((await markPaid(firstPayment)).status, "paid");
  assert.equal((await markPaid(latePayment)).status, "refund_due");
  assert.equal(await markPaid(latePayment), null, "already recorded");
  assert.equal((await api.request("GET", `/api/listings/${listing.id}`)).body.listing.status, "sold");

  // The buyer coming back from Stripe is told the truth, not "payment received".
  const confirm = await api.request("POST", "/api/payments/confirm", {
    token: late.token,
    body: { sessionId: `cs_test_${late.id}` },
  });
  assert.deepEqual(confirm.body, { status: "refund_due" });
});

test("a payment after the seller marked the item sold themselves is also refund_due", async () => {
  const [seller, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(seller);
  const payment = await pendingPayment(listing, buyer);
  await api.request("PATCH", `/api/listings/${listing.id}`, { token: seller.token, body: { status: "sold" } });
  assert.equal((await markPaid(payment)).status, "refund_due");
});

test("two payments confirmed at the same moment: exactly one buys the item", async () => {
  const [seller, a, b] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const listing = await api.createListing(seller);
  const ids = [await pendingPayment(listing, a), await pendingPayment(listing, b)];
  const results = await Promise.all(ids.map((id) => markPaid(id)));
  assert.deepEqual(results.map((row) => row.status).sort(), ["paid", "refund_due"]);
});
