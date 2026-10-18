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
