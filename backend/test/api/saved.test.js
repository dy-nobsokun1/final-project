import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { startApi, waitFor } from "./helpers.js";

const api = await startApi();
after(() => api.close());

const ids = (response) => response.body.listings.map((listing) => listing.id);

function save(listingId, user) {
  return api.request("POST", `/api/listings/${listingId}/save`, { token: user?.token });
}

function unsave(listingId, user) {
  return api.request("DELETE", `/api/listings/${listingId}/save`, { token: user.token });
}

function mySaved(user) {
  return api.request("GET", "/api/users/me/saved", { token: user.token });
}

async function saveCount(listingId) {
  return (await api.request("GET", `/api/listings/${listingId}`)).body.listing.saveCount;
}

function patch(owner, listingId, body) {
  return api.request("PATCH", `/api/listings/${listingId}`, { token: owner.token, body });
}

/** The price-drop emails the app would have sent for this listing title so far. */
function priceDrops(title) {
  return api.skippedEmails().filter((line) => line.includes(`Price drop: "${title}"`));
}

test("saving a listing needs a login, and you cannot save your own", async () => {
  const owner = await api.createUser();
  const listing = await api.createListing(owner);

  assert.equal((await save(listing.id)).status, 401);
  const own = await save(listing.id, owner);
  assert.equal(own.status, 400);
  assert.equal(own.body.error, "You cannot save your own listing.");
  assert.equal(await saveCount(listing.id), 0);

  assert.equal((await save(randomUUID(), owner)).status, 404);
  assert.equal((await save("not-a-real-id", owner)).status, 404);
  assert.equal((await api.request("GET", "/api/users/me/saved")).status, 401);
  assert.equal((await api.request("GET", "/api/users/me/saved/ids")).status, 401);
});

test("saving twice is harmless, and my saved list is newest first with a public count", async () => {
  const [owner, buyer, otherBuyer] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const a = await api.createListing(owner, { title: "Quokka saved kettle" });
  const b = await api.createListing(owner, { title: "Quokka saved toaster" });

  for (const listing of [a, b, a]) {
    const response = await save(listing.id, buyer);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { saved: true });
  }
  // Saving A again kept its first save time, so B (saved after it) stays on top.
  assert.deepEqual(ids(await mySaved(buyer)), [b.id, a.id]);
  const savedIds = await api.request("GET", "/api/users/me/saved/ids", { token: buyer.token });
  assert.deepEqual(savedIds.body.listingIds.sort(), [a.id, b.id].sort());
  assert.equal(await saveCount(a.id), 1);

  assert.equal((await save(a.id, otherBuyer)).status, 200);
  assert.equal(await saveCount(a.id), 2);
  const search = await api.request("GET", `/api/listings?query=${encodeURIComponent("Quokka saved kettle")}`);
  assert.equal(search.body.listings.find((listing) => listing.id === a.id).saveCount, 2);
  // Each student sees only their own saves.
  assert.deepEqual(ids(await mySaved(otherBuyer)), [a.id]);
});

test("a saved listing stays saved when it is sold, and unsaving is harmless too", async () => {
  const [owner, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  await save(listing.id, buyer);

  assert.equal((await patch(owner, listing.id, { status: "sold" })).status, 200);
  const saved = await mySaved(buyer);
  assert.deepEqual(ids(saved), [listing.id]);
  assert.equal(saved.body.listings[0].status, "sold");

  assert.equal((await unsave(listing.id, buyer)).status, 204);
  assert.equal((await unsave(listing.id, buyer)).status, 204);
  assert.deepEqual(ids(await mySaved(buyer)), []);
  assert.equal(await saveCount(listing.id), 0);
});

test("deleting a listing removes its saves and is not blocked by them", async () => {
  const [owner, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  await save(listing.id, buyer);

  assert.equal((await api.request("DELETE", `/api/listings/${listing.id}`, { token: owner.token })).status, 204);
  assert.ok(!ids(await mySaved(buyer)).includes(listing.id));
  const [{ n }] = await api.sql("SELECT count(*)::int AS n FROM saved_listings WHERE listing_id = $1", [listing.id]);
  assert.equal(n, 0);
});

test("lowering the price of a saved item for sale alerts everyone who saved it", async () => {
  const [owner, saverA, saverB, bystander] = await Promise.all(
    [api.createUser(), api.createUser(), api.createUser(), api.createUser()]);
  const title = "Quokka price lamp";
  const listing = await api.createListing(owner, { title, price: 25 });
  await save(listing.id, saverA);
  await save(listing.id, saverB);

  // A higher price, then the same price again (saving the edit form unchanged): no alert.
  assert.equal((await patch(owner, listing.id, { price: 30 })).status, 200);
  assert.equal((await patch(owner, listing.id, { title, price: 30 })).status, 200);
  assert.equal((await patch(owner, listing.id, { price: 20 })).status, 200);

  const alerted = (user) => priceDrops(title).some((line) => line.includes("is now $20") && line.endsWith(` to ${user.email}`));
  await waitFor(() => alerted(saverA) && alerted(saverB));
  const lines = priceDrops(title);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => !line.includes(bystander.email) && !line.includes(owner.email)));
});

test("price alerts are only for available items for sale", async () => {
  const [owner, saver] = await Promise.all([api.createUser(), api.createUser()]);
  const inOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const trade = await api.createListing(owner, { title: "Quokka trade globe", listingType: "trade", price: 10 });
  const reserved = await api.createListing(owner, { title: "Quokka reserved chair", price: 25 });
  const auction = await api.createListing(owner,
    { title: "Quokka auction clock", listingType: "auction", price: 25, auctionEndsAt: inOneDay });
  const control = await api.createListing(owner, { title: "Quokka control mug", price: 25 });
  for (const listing of [trade, reserved, auction, control]) await save(listing.id, saver);

  assert.equal((await patch(owner, trade.id, { price: 5 })).status, 200);
  assert.equal((await patch(owner, reserved.id, { status: "reserved" })).status, 200);
  assert.equal((await patch(owner, reserved.id, { price: 5 })).status, 200);
  assert.equal((await patch(owner, auction.id, { price: 5 })).status, 200);
  assert.equal((await patch(owner, control.id, { price: 20 })).status, 200);

  // The control's alert was triggered last, so once it arrives any wrong alert would have too.
  await waitFor(() => priceDrops("Quokka control mug").length === 1);
  for (const title of ["Quokka trade globe", "Quokka reserved chair", "Quokka auction clock"]) {
    assert.deepEqual(priceDrops(title), []);
  }
});
