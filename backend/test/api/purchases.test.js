import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

const api = await startApi();
after(() => api.close());
const { markPaid } = await import("../../src/db/payments.js");

const purchases = async (user) =>
  (await api.request("GET", "/api/users/me/purchases", { token: user.token })).body.purchases;

test("purchases need a sign-in", async () => {
  assert.equal((await api.request("GET", "/api/users/me/purchases")).status, 401);
});

test("a paid purchase shows how and how much, and only your own purchases appear", async () => {
  const [me, seller, other] = await Promise.all(["Me", "Seller", "Other"].map((n) => api.createUser(n)));
  const chair = await api.createListing(seller, { price: 45 });
  const [payment] = await api.sql(
    "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, 45, $3) RETURNING id",
    [chair.id, me.id, `cs_test_${chair.id}`],
  );
  await markPaid(payment.id);
  // My own sale and someone else's purchase must not appear.
  const mine = await api.createListing(me, { price: 10 });
  await api.request("PATCH", `/api/listings/${mine.id}`, { token: me.token, body: { status: "sold" } });

  const list = await purchases(me);
  assert.equal(list.length, 1);
  assert.equal(list[0].listing.id, chair.id);
  assert.equal(list[0].listing.seller.name, "Seller");
  assert.equal(list[0].amount, 45);
  assert.equal(list[0].how, "card");
  assert.equal(list[0].myRating, null);
  assert.ok(list[0].at);
  assert.deepEqual(await purchases(other), []);
  assert.deepEqual(await purchases(seller), []);
});

test("myRating fills in after you review the deal, and limit is respected", async () => {
  const [me, seller] = await Promise.all(["Me", "Seller"].map((n) => api.createUser(n)));
  for (const title of ["Lamp", "Fan"]) {
    const item = await api.createListing(seller, { title, price: 5 });
    const [payment] = await api.sql(
      "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, 5, $3) RETURNING id",
      [item.id, me.id, `cs_test_${item.id}`],
    );
    await markPaid(payment.id);
  }
  const [newest] = await purchases(me);
  const review = await api.request("POST", `/api/listings/${newest.listing.id}/reviews`, {
    token: me.token, body: { revieweeId: seller.id, rating: 4, comment: "Good" },
  });
  assert.equal(review.status, 201);
  assert.equal((await purchases(me)).find((p) => p.listing.id === newest.listing.id).myRating, 4);
  assert.equal((await api.request("GET", "/api/users/me/purchases?limit=1", { token: me.token })).body.purchases.length, 1);
});
