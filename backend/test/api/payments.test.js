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
  // Returning from Stripe without a body is "not found", not a server error.
  assert.equal((await api.request("POST", "/api/payments/confirm", { token: buyer.token })).status, 404);
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

test("the receipt is for the buyer and the seller only, shows the amount really paid, and needs a paid payment", async () => {
  const [seller, buyer, stranger] = await Promise.all([api.createUser("Seller One"), api.createUser("Buyer One"), api.createUser()]);
  const listing = await api.createListing(seller, { title: "Receipt lamp", price: 40 });
  const receipt = (user, id = listing.id) => api.request("GET", `/api/payments/receipt/${id}`, { token: user?.token });

  // Nothing is paid yet: 404 for everyone, even the seller.
  assert.equal((await receipt(seller)).status, 404);
  assert.equal((await receipt(buyer)).status, 404);

  // An accepted offer made the buyer pay $32.50, below the $40 asking price.
  const [{ id: paymentId }] = await api.sql(
    "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, 32.5, 'cs_test_receipt') RETURNING id",
    [listing.id, buyer.id],
  );
  assert.equal((await receipt(buyer)).status, 404); // still pending
  assert.equal((await markPaid(paymentId)).status, "paid");

  const bought = await receipt(buyer);
  assert.equal(bought.status, 200);
  const { receipt: shown } = bought.body;
  assert.equal(shown.invoiceNo, `UNI-${listing.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`);
  assert.deepEqual(
    [shown.amount, shown.method, shown.title, shown.sellerName, shown.buyerName],
    [32.5, "stripe", "Receipt lamp", "Seller One", "Buyer One"],
  );
  assert.ok(!Number.isNaN(Date.parse(shown.paidAt)));
  assert.deepEqual((await receipt(seller)).body, bought.body);

  assert.equal((await receipt(stranger)).status, 404);
  assert.equal((await receipt(null)).status, 401);
  assert.equal((await receipt(buyer, "not-a-uuid")).status, 404);
});

test("a payment that became refund_due gets no receipt", async () => {
  const [seller, first, late] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const listing = await api.createListing(seller);
  await markPaid(await pendingPayment(listing, first));
  await markPaid(await pendingPayment(listing, late));
  const receipt = (user) => api.request("GET", `/api/payments/receipt/${listing.id}`, { token: user.token });
  assert.equal((await receipt(first)).status, 200);
  assert.equal((await receipt(late)).status, 404);
});
