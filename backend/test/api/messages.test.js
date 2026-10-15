import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

const api = await startApi();
after(() => api.close());

function send(from, to, listing, body) {
  return api.request("POST", "/api/messages", {
    token: from.token,
    body: { listingId: listing.id, receiverId: to.id, body },
  });
}

test("a buyer messages the owner, who sees one unread thread until opening it", async () => {
  const [owner, buyer] = await Promise.all([api.createUser("Owner"), api.createUser("Buyer")]);
  const listing = await api.createListing(owner);
  assert.equal((await send(buyer, owner, listing, "Is it still available?")).status, 201);

  const inbox = await api.request("GET", "/api/messages/conversations", { token: owner.token });
  assert.deepEqual(
    inbox.body.conversations.map(({ listingId, partnerId, unreadCount }) => ({ listingId, partnerId, unreadCount })),
    [{ listingId: listing.id, partnerId: buyer.id, unreadCount: 1 }],
  );

  const threadPath = `/api/messages?listingId=${listing.id}&withUserId=${buyer.id}`;
  const thread = await api.request("GET", threadPath, { token: owner.token });
  assert.deepEqual(thread.body.messages.map((message) => message.body), ["Is it still available?"]);

  await api.request("PATCH", "/api/messages/read", { token: owner.token, body: { listingId: listing.id, withUserId: buyer.id } });
  const afterReading = await api.request("GET", "/api/messages/conversations", { token: owner.token });
  assert.equal(afterReading.body.conversations[0].unreadCount, 0);
});

test("a thread is private to its two people", async () => {
  const [owner, buyer, stranger] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  await send(buyer, owner, listing, "Can you do $20?");

  // The stranger asks for "my thread with the owner": they only ever get their own messages.
  const peek = await api.request("GET", `/api/messages?listingId=${listing.id}&withUserId=${owner.id}`, {
    token: stranger.token,
  });
  assert.deepEqual(peek.body.messages, []);
});

test("every message about a listing must include its owner", async () => {
  const [owner, buyer, stranger] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  assert.equal((await send(stranger, buyer, listing, "Psst, mine is cheaper")).status, 400);
});

test("you cannot message yourself, and empty messages are refused", async () => {
  const [owner, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  assert.equal((await send(owner, owner, listing, "Note to self")).status, 400);
  assert.equal((await send(buyer, owner, listing, "   ")).status, 400);
});
