import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

// KHQR is switched on for this file, but Bakong itself is replaced: requests to its API get
// "paid" for the MD5s in `paidMd5s` and "not found" for everything else, or a 403 (as from outside
// Cambodia) while `bakong.isDown` is true. All other requests (the tests calling our API) go
// through as normal.
const realFetch = globalThis.fetch;
const paidMd5s = new Set();
const bakong = { isDown: false };
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith("https://api-bakong.nbc.gov.kh/")) return realFetch(url, options);
  if (bakong.isDown) return Response.json({ error: "forbidden" }, { status: 403 });
  const { md5 } = JSON.parse(options.body);
  return Response.json(paidMd5s.has(md5)
    ? { responseCode: 0, data: { hash: "test" } }
    : { responseCode: 1, errorCode: 1, responseMessage: "Transaction could not be found." });
};

const api = await startApi({ env: { BAKONG_TOKEN: "test-token" } });
after(() => api.close());
const { khqrMd5 } = await import("../../src/utils/khqr.js");
const { findOpenKhqrPayments } = await import("../../src/db/payments.js");

const startKhqr = (user, listing) => api.request("POST", "/api/payments/khqr", {
  token: user.token,
  body: { listingId: listing.id },
});
const khqrStatus = (user, paymentId) => api.request("GET", `/api/payments/khqr/${paymentId}`, { token: user.token });

test("a seller adds a Bakong account; it stays private, and listings say they accept KHQR", async () => {
  const seller = await api.createUser();
  const save = (bakongAccountId) => api.request("PATCH", "/api/users/me", { token: seller.token, body: { bakongAccountId } });

  assert.equal((await save("not an account")).status, 400);
  assert.equal((await save(" sokunth@aclb ")).body.user.bakongAccountId, "sokunth@aclb");
  assert.equal((await api.request("GET", `/api/users/${seller.id}`)).body.user.bakongAccountId, undefined);
  const listing = await api.createListing(seller);
  assert.equal(listing.seller.acceptsKhqr, true);

  assert.equal((await save("")).body.user.bakongAccountId, null);
  const updated = await api.request("GET", `/api/listings/${listing.id}`);
  assert.equal(updated.body.listing.seller.acceptsKhqr, false);
});

test("KHQR needs the seller to have a Bakong account", async () => {
  const [seller, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(seller);
  assert.deepEqual((await api.request("GET", "/api/payments/config")).body, { enabled: false, khqr: true });
  assert.equal((await startKhqr(buyer, listing)).status, 400);
});

test("a buyer gets one QR for the seller's account; Bakong confirming it marks the item sold", async () => {
  const [seller, buyer, other] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  await api.request("PATCH", "/api/users/me", { token: seller.token, body: { bakongAccountId: "seller@aclb" } });
  const listing = await api.createListing(seller, { price: 12.5 });

  const first = await startKhqr(buyer, listing);
  assert.equal(first.status, 201);
  assert.equal(first.body.amount, 12.5);
  assert.match(first.body.qr, /0011seller@aclb.*540512\.50/);
  // Asking again shows the same QR, and nobody else can start paying meanwhile.
  assert.equal((await startKhqr(buyer, listing)).body.paymentId, first.body.paymentId);
  assert.equal((await startKhqr(other, listing)).status, 409);

  const { paymentId } = first.body;
  assert.deepEqual((await khqrStatus(buyer, paymentId)).body, { status: "pending" });
  assert.equal((await khqrStatus(other, paymentId)).status, 404);

  paidMd5s.add(khqrMd5(first.body.qr)); // the buyer pays in their banking app
  assert.deepEqual((await khqrStatus(buyer, paymentId)).body, { status: "paid" });
  assert.equal((await api.request("GET", `/api/listings/${listing.id}`)).body.listing.status, "sold");
  assert.equal((await startKhqr(other, listing)).status, 400); // no longer available
});

test("an unpaid QR expires after 30 minutes, and the buyer can then get a new one", async () => {
  const [seller, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  await api.request("PATCH", "/api/users/me", { token: seller.token, body: { bakongAccountId: "seller@aclb" } });
  const listing = await api.createListing(seller);

  const { paymentId } = (await startKhqr(buyer, listing)).body;
  await api.sql("UPDATE payments SET created_at = now() - interval '31 minutes' WHERE id = $1", [paymentId]);
  assert.deepEqual((await khqrStatus(buyer, paymentId)).body, { status: "expired" });
  assert.notEqual((await startKhqr(buyer, listing)).body.paymentId, paymentId);
});

test("no QR is shown while Bakong cannot be reached, since its payment could not be confirmed", async () => {
  const [seller, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  await api.request("PATCH", "/api/users/me", { token: seller.token, body: { bakongAccountId: "seller@aclb" } });
  const listing = await api.createListing(seller);

  bakong.isDown = true;
  try {
    const refused = await startKhqr(buyer, listing);
    assert.equal(refused.status, 503);
    assert.match(refused.body.error, /cannot reach Bakong/);
    assert.deepEqual(await api.sql("SELECT id FROM payments WHERE listing_id = $1", [listing.id]), []);
  } finally {
    bakong.isDown = false;
  }
  assert.equal((await startKhqr(buyer, listing)).status, 201);
});

test("an unconfirmed QR keeps being re-checked for 24 hours, then is left alone", async () => {
  const [seller, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  await api.request("PATCH", "/api/users/me", { token: seller.token, body: { bakongAccountId: "seller@aclb" } });
  const { paymentId } = (await startKhqr(buyer, await api.createListing(seller))).body;
  const isChecked = async (options) => (await findOpenKhqrPayments(options)).some((payment) => payment.id === paymentId);
  const age = (interval) => api.sql("UPDATE payments SET created_at = now() - $2::interval WHERE id = $1", [paymentId, interval]);

  assert.equal(await isChecked(), true); // new: checked every minute
  await age("3 hours");
  assert.equal(await isChecked(), false);
  assert.equal(await isChecked({ includeOlder: true }), true); // held up: still checked every 15 minutes
  await age("25 hours");
  assert.equal(await isChecked({ includeOlder: true }), false);
});

test("a listing cannot be deleted while a payment for it may still be confirmed, or once it was paid", async () => {
  const [seller, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  await api.request("PATCH", "/api/users/me", { token: seller.token, body: { bakongAccountId: "seller@aclb" } });
  const deleteListing = (listing) => api.request("DELETE", `/api/listings/${listing.id}`, { token: seller.token });

  // Deleting the listing would also delete its payment record, and an unconfirmed payment can still
  // be confirmed for 24 hours (the background re-check), so until then the delete is refused.
  const open = await api.createListing(seller);
  const { paymentId } = (await startKhqr(buyer, open)).body;
  const age = (interval) => api.sql("UPDATE payments SET created_at = now() - $2::interval WHERE id = $1", [paymentId, interval]);
  await age("31 minutes"); // the QR itself has expired, but a held-up confirmation can still arrive
  assert.match((await deleteListing(open)).body.error, /for another 24 hours/);
  await age("23 hours 50 minutes");
  assert.match((await deleteListing(open)).body.error, /for another 11 minutes/);
  await age("24 hours 2 minutes"); // nothing can confirm it any more: an abandoned QR
  assert.equal((await deleteListing(open)).status, 204);

  // Paid, then made available again by the seller: the payment record must still stay.
  const paid = await api.createListing(seller);
  const started = (await startKhqr(buyer, paid)).body;
  paidMd5s.add(khqrMd5(started.qr));
  assert.deepEqual((await khqrStatus(buyer, started.paymentId)).body, { status: "paid" });
  const relisted = await api.request("PATCH", `/api/listings/${paid.id}`, { token: seller.token, body: { status: "active" } });
  assert.equal(relisted.body.listing.status, "active");
  assert.equal((await deleteListing(paid)).status, 409);
  assert.deepEqual(await api.sql("SELECT status FROM payments WHERE id = $1", [started.paymentId]), [{ status: "paid" }]);
  // A late payment the seller must refund is kept as well.
  await api.sql("UPDATE payments SET status = 'refund_due' WHERE id = $1", [started.paymentId]);
  assert.equal((await deleteListing(paid)).status, 409);
});
