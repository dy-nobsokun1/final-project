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

test("a sold listing leaves the browse page but stays on the seller's profile", async () => {
  const seller = await api.createUser();
  const listing = await api.createListing(seller);
  await api.request("PATCH", `/api/listings/${listing.id}`, { token: seller.token, body: { status: "sold" } });

  assert.equal(ids(await api.request("GET", "/api/listings")).includes(listing.id), false);
  assert.equal(ids(await api.request("GET", "/api/listings?status=sold")).includes(listing.id), true);
  const profile = await api.request("GET", `/api/users/${seller.id}/listings`);
  assert.deepEqual(profile.body.listings.map((item) => item.status), ["sold"]);
});
