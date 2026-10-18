import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { startApi, waitFor } from "./helpers.js";

const api = await startApi();
after(() => api.close());
// Loaded after startApi, which points the app at the test database.
const { findWantedForItem } = await import("../../src/db/matches.js");

// Test files run at the same time against one database, so every title here uses a made-up word
// ("Zorbex", "Vantrix", "Quellum", "Morvane") that no other test file posts.

const sortedIds = (listings) => listings.map((listing) => listing.id).sort();

function matches(listingId) {
  return api.request("GET", `/api/listings/${listingId}/matches`);
}

function patch(owner, listingId, body) {
  return api.request("PATCH", `/api/listings/${listingId}`, { token: owner.token, body });
}

function wanted(owner, fields) {
  return api.createListing(owner, { listingType: "buy_request", ...fields });
}

/** The wanted-match alerts the app would have emailed to `email` so far. */
function alertsTo(email) {
  return api.skippedEmails().filter((line) => line.includes("something you're looking for") && line.endsWith(` to ${email}`));
}

test("a wanted post lists matching items: typos, descriptions and a leading Looking for count; its own owner's, other wanted posts, closed, ended, over-budget and other-category items do not", async () => {
  const [poster, seller, otherPoster] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const post = await wanted(poster, { title: "Looking for Zorbex headphones", category: "electronics", price: 50 });
  const item = (fields) => api.createListing(seller, { category: "electronics", ...fields });

  const exact = await item({ title: "Zorbex headphones, barely used", price: 40 });
  const typo = await item({ title: "Zorbx headphones", price: 30 });
  const described = await item({ title: "Wireless audio set", description: "Original Zorbex headphones with the box.", price: 45 });
  await item({ title: "Zorbex headphones pro", price: 80 }); // over the $50 budget
  await item({ title: "Zorbex headphones stand", category: "furniture", price: 10 });
  const reserved = await item({ title: "Zorbex headphones", price: 20 });
  assert.equal((await patch(seller, reserved.id, { status: "reserved" })).status, 200);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const auction = await item({ title: "Zorbex headphones auction", listingType: "auction", price: 10, auctionEndsAt: tomorrow });
  await api.sql("UPDATE listings SET auction_ends_at = now() - interval '1 minute' WHERE id = $1", [auction.id]);
  await wanted(otherPoster, { title: "Zorbex headphones", category: "electronics" });
  await api.createListing(poster, { title: "Zorbex headphones", category: "electronics", price: 20 });

  const response = await matches(post.id);
  assert.equal(response.status, 200);
  assert.deepEqual(sortedIds(response.body.listings), sortedIds([exact, typo, described]));
  assert.equal(response.body.listings[0].id, exact.id, "the closest title comes first");
});

test("an item lists the wanted posts it could fill: active, verified, other students', within budget, same category or Other", async () => {
  const [seller, a, b, c, d, f, g] = await Promise.all(Array.from({ length: 7 }, () => api.createUser()));
  const wA = await wanted(a, { title: "Wanted: Vantrix speaker", category: "electronics", price: 0 });
  const wB = await wanted(b, { title: "Vantrix speaker", category: "other", price: 100 });
  await wanted(c, { title: "Vantrix speaker", category: "electronics", price: 5 }); // budget too low
  const wD = await wanted(d, { title: "Vantrix speaker", category: "electronics", price: 0 });
  assert.equal((await patch(d, wD.id, { status: "reserved" })).status, 200);
  await wanted(seller, { title: "Vantrix speaker", category: "electronics", price: 0 }); // the seller's own
  await wanted(f, { title: "Vantrix speaker", category: "electronics", price: 0 });
  await api.sql("UPDATE users SET is_verified = false WHERE id = $1", [f.id]);
  await wanted(g, { title: "Vantrix speaker", category: "clothing", price: 0 });
  const item = await api.createListing(seller, { title: "Vantrix bluetooth speaker", category: "electronics", price: 30 });

  const response = await matches(item.id);
  assert.equal(response.status, 200);
  assert.deepEqual(sortedIds(response.body.listings), sortedIds([wA, wB]));
  assert.ok(response.body.listings.every((listing) => listing.listingType === "buy_request"));
  const best = await findWantedForItem(item.id, 1);
  assert.equal(best.length, 1);
  assert.ok([wA.id, wB.id].includes(best[0].id));
});

test("posting an item alerts each matching student once, in the background; wanted posts and edits alert nobody", async () => {
  const [alice, bob, carol, seller] = await Promise.all([api.createUser(), api.createUser(), api.createUser(), api.createUser()]);
  const furniture = { category: "furniture" };
  await wanted(alice, { ...furniture, title: "Quellum desk lamp", price: 0 });
  await wanted(alice, { ...furniture, title: "Need a Quellum lamp" }); // budget $25
  await wanted(bob, { ...furniture, title: "Looking for a Quellum desk lamp", price: 20 });
  await wanted(seller, { ...furniture, title: "Quellum desk lamp" });

  const lamp = await api.createListing(seller, { ...furniture, title: "Quellum desk lamp", price: 15 });
  await waitFor(() => alertsTo(alice.email).length && alertsTo(bob.email).length);
  assert.equal(alertsTo(alice.email).length, 1, "two matching posts, one message");
  assert.equal(alertsTo(bob.email).length, 1);
  assert.equal(alertsTo(seller.email).length, 0, "never about your own item");
  assert.ok(alertsTo(alice.email)[0].includes('"Quellum desk lamp"'));

  assert.equal((await patch(seller, lamp.id, { title: "Quellum desk lamp, white" })).status, 200);
  await wanted(carol, { ...furniture, title: "Quellum desk lamp" });
  // Give any (wrong) background alert time to arrive.
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(alertsTo(alice.email).length, 1);
  assert.equal(alertsTo(bob.email).length, 1);
  assert.equal(alertsTo(seller.email).length, 0);
  assert.equal(alertsTo(carol.email).length, 0);
});

test("matches: 404 for unknown or malformed ids, empty once the listing is not active, and a title with no real words matches nothing", async () => {
  assert.equal((await matches(randomUUID())).status, 404);
  assert.equal((await matches("not-an-id")).status, 404);

  const [poster, seller] = await Promise.all([api.createUser(), api.createUser()]);
  const post = await wanted(poster, { title: "Morvane lunch box", category: "other", price: 0 });
  await api.createListing(seller, { title: "The Morvane lunch box", category: "other", price: 5 });
  assert.equal((await matches(post.id)).body.listings.length, 1);
  assert.equal((await patch(poster, post.id, { status: "reserved" })).status, 200);
  assert.deepEqual((await matches(post.id)), { status: 200, body: { listings: [] } });

  // "Wanted:" alone leaves no search term, and "the" is only a word full-text search ignores. The
  // typo test alone would match "The Morvane lunch box" above, so this checks the words are required.
  for (const title of ["Wanted:", "Looking for the"]) {
    const empty = await wanted(poster, { title, category: "other", price: 0 });
    assert.deepEqual((await matches(empty.id)), { status: 200, body: { listings: [] } });
  }
});
