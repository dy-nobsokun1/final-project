import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

const api = await startApi();
after(() => api.close());

const ids = (response) => response.body.listings.map((listing) => listing.id);

test("posting a listing needs a login and valid fields", async () => {
  const seller = await api.createUser();
  const fields = { title: "Desk lamp", category: "furniture", condition: "good", price: 8 };
  assert.equal((await api.request("POST", "/api/listings", { body: fields })).status, 401);

  const invalid = await api.request("POST", "/api/listings", {
    token: seller.token,
    body: { ...fields, category: "cars", price: -1 },
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(Object.keys(invalid.body.details).sort(), ["category", "price"]);

  const created = await api.request("POST", "/api/listings", { token: seller.token, body: fields });
  assert.equal(created.status, 201);
  assert.equal(created.body.listing.seller.id, seller.id);
  assert.equal(created.body.listing.status, "active");
});

test("only the owner can change or delete a listing", async () => {
  const [owner, stranger] = await Promise.all([api.createUser(), api.createUser()]);
  const path = `/api/listings/${(await api.createListing(owner)).id}`;

  assert.equal((await api.request("PATCH", path, { token: stranger.token, body: { price: 1 } })).status, 403);
  assert.equal((await api.request("DELETE", path, { token: stranger.token })).status, 403);

  const updated = await api.request("PATCH", path, { token: owner.token, body: { price: 30 } });
  assert.equal(updated.body.listing.price, 30);
  assert.equal((await api.request("DELETE", path, { token: owner.token })).status, 204);
  assert.equal((await api.request("GET", path)).status, 404);
});

test("a sold or traded listing cannot be deleted, so its record and reviews stay", async () => {
  const owner = await api.createUser();
  for (const status of ["sold", "traded"]) {
    const path = `/api/listings/${(await api.createListing(owner)).id}`;
    await api.request("PATCH", path, { token: owner.token, body: { status } });
    assert.equal((await api.request("DELETE", path, { token: owner.token })).status, 409, status);
    assert.equal((await api.request("GET", path)).status, 200, status);
  }
});

test("a listing with reviews cannot be deleted, even after it is made available again", async () => {
  const [owner, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  const path = `/api/listings/${listing.id}`;
  await api.request("PATCH", path, { token: owner.token, body: { status: "sold" } });
  // The review rules themselves are tested in reviews.test.js; here we only need one to exist.
  await api.sql("INSERT INTO reviews (listing_id, reviewer_id, reviewee_id, rating) VALUES ($1, $2, $3, 5)",
    [listing.id, buyer.id, owner.id]);
  const relisted = await api.request("PATCH", path, { token: owner.token, body: { status: "active" } });
  assert.equal(relisted.body.listing.status, "active");

  assert.equal((await api.request("DELETE", path, { token: owner.token })).status, 409);
  assert.equal((await api.sql("SELECT count(*)::int AS n FROM reviews WHERE listing_id = $1", [listing.id]))[0].n, 1);
});

test("a malformed listing id is a 404, not a server error", async () => {
  assert.equal((await api.request("GET", "/api/listings/not-a-real-id")).status, 404);
});

test("search finds a listing from a misspelled or partial title word", async () => {
  const seller = await api.createUser();
  // "Quokka" is in no other test's listings, so only this one can match.
  const listing = await api.createListing(seller, { title: "Quokka lantern" });
  for (const search of ["quoka", "lante", "Quokka lantern"]) {
    const response = await api.request("GET", `/api/listings?query=${encodeURIComponent(search)}`);
    assert.deepEqual(ids(response), [listing.id], `searching "${search}"`);
  }
});

test("short terms skip the typo test, so 'ram' does not find a racket, but 'rackt' does", async () => {
  const seller = await api.createUser();
  const racket = await api.createListing(seller, { title: "Badminton racket", description: "Light, with two shuttlecocks." });
  assert.ok(!ids(await api.request("GET", "/api/listings?query=ram")).includes(racket.id), "ram");
  assert.ok(ids(await api.request("GET", "/api/listings?query=rackt")).includes(racket.id), "rackt");
});

test("a search with a limit returns at most that many, best match first", async () => {
  const seller = await api.createUser();
  // "Platypus" is in no other test's listings. The title match is posted first, so it is the
  // oldest: only ranking (not newest first) can put it at the top.
  const best = await api.createListing(seller, { title: "Platypus lamp" });
  for (let i = 0; i < 2; i += 1) {
    await api.createListing(seller, { title: "Desk lamp", description: "Shaped like a platypus." });
  }
  assert.equal(ids(await api.request("GET", "/api/listings?query=platypus")).length, 3);

  const limited = await api.request("GET", "/api/listings?query=platypus&limit=2");
  assert.equal(limited.status, 200);
  assert.equal(ids(limited).length, 2);
  assert.equal(ids(limited)[0], best.id);
});

// Other test files post textbooks and electronics at the same time, so these two tests filter by a
// price no other test uses.
test("'book' finds a textbook whose title and description never say book", async () => {
  const seller = await api.createUser();
  const calculus = await api.createListing(seller, { title: "Calculus 8th edition", category: "textbooks", price: 913 });
  for (const search of ["book", "books"]) {
    const response = await api.request("GET", `/api/listings?query=${search}&minPrice=913&maxPrice=913`);
    assert.deepEqual(ids(response), [calculus.id], search);
  }
});

test("'gpu' and 'graphics card' find an RTX card, after an item that says GPU; wanted matches do not", async () => {
  const [seller, poster] = await Promise.all([api.createUser(), api.createUser()]);
  // The GPU item is posted first, so only ranking (not newest first) can put it above the RTX card.
  const gpu = await api.createListing(seller, { title: "Budget GPU", category: "electronics", price: 917 });
  const rtx = await api.createListing(seller, { title: "RTX 4060", category: "electronics", price: 917 });
  const search = (term) => api.request("GET", `/api/listings?query=${encodeURIComponent(term)}&minPrice=917&maxPrice=917`);
  assert.deepEqual(ids(await search("gpu")), [gpu.id, rtx.id]);
  assert.ok(ids(await search("graphics card")).includes(rtx.id));

  // Wanted-post matching sends alerts, so it keeps to the post's own words.
  const post = await api.createListing(poster, {
    title: "Looking for a GPU", category: "electronics", listingType: "buy_request", price: 0,
  });
  const matched = ids(await api.request("GET", `/api/listings/${post.id}/matches`));
  assert.ok(matched.includes(gpu.id), "the item that says GPU");
  assert.ok(!matched.includes(rtx.id), "the RTX card");
});

test("a sold listing leaves the browse page but stays on the seller's profile", async () => {
  const seller = await api.createUser();
  const listing = await api.createListing(seller);
  await api.request("PATCH", `/api/listings/${listing.id}`, { token: seller.token, body: { status: "sold" } });

  assert.equal(ids(await api.request("GET", "/api/listings")).includes(listing.id), false);
  assert.equal(ids(await api.request("GET", "/api/listings?status=sold")).includes(listing.id), true);
  const profile = await api.request("GET", `/api/users/${seller.id}/listings`);
  assert.deepEqual(profile.body.listings.map((item) => item.status), ["sold"]);
});
