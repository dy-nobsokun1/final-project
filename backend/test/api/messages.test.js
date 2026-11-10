import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { streamCount } from "../../src/utils/liveHub.js";
import { startApi, waitFor } from "./helpers.js";

const api = await startApi();
after(() => api.close());

function send(from, to, listing, body) {
  return api.request("POST", "/api/messages", {
    token: from.token,
    body: { listingId: listing.id, receiverId: to.id, body },
  });
}

/**
 * Opens `user`'s live stream (GET /api/messages/stream). next() waits for the next message event
 * (skipping ": ping" lines) and fails after 2 s. Always close() it: an open stream keeps the
 * test server from stopping.
 */
async function openStream(user, params = {}) {
  const controller = new AbortController();
  const response = await fetch(`${api.baseUrl}/api/messages/stream?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${user.token}` },
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  async function readEvent() {
    for (;;) {
      const end = buffer.indexOf("\n\n");
      if (end !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame.split("\n").find((line) => line.startsWith("data: "));
        if (data) return JSON.parse(data.slice("data: ".length));
      } else {
        const { value, done } = await reader.read();
        if (done) throw new Error("The stream ended.");
        buffer += value;
      }
    }
  }

  function next() {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("No live message within 2 s.")), 2000);
    });
    return Promise.race([readEvent(), timeout]).finally(() => clearTimeout(timer));
  }

  return { next, close: () => controller.abort() };
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

test("each inbox row has its listing's title, category and cover photo and the newest message", async () => {
  const [owner, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const lamp = await api.createListing(owner, { title: "Desk lamp", category: "furniture" });
  const bike = await api.createListing(owner, { title: "Old bike", category: "bikes" });
  const photos = ["https://example.com/cover.jpg", "https://example.com/side.jpg"];
  await api.sql("UPDATE listings SET image_urls = $1 WHERE id = $2", [photos, lamp.id]);
  await send(buyer, owner, lamp, "Is it still available?");
  await send(owner, buyer, lamp, "Yes, come by at 5.");
  await send(buyer, owner, bike, "Does it have gears?");

  const inbox = async (user) =>
    (await api.request("GET", "/api/messages/conversations", { token: user.token })).body.conversations;
  const [ownerRows, buyerRows] = await Promise.all([inbox(owner), inbox(buyer)]);
  // Newest thread first; the bike has no photo.
  assert.deepEqual(
    ownerRows.map(({ listingId, listingTitle, listingCategory, listingImageUrl, lastMessageBody, lastMessageIsMine }) =>
      ({ listingId, listingTitle, listingCategory, listingImageUrl, lastMessageBody, lastMessageIsMine })),
    [
      { listingId: bike.id, listingTitle: "Old bike", listingCategory: "bikes", listingImageUrl: null, lastMessageBody: "Does it have gears?", lastMessageIsMine: false },
      { listingId: lamp.id, listingTitle: "Desk lamp", listingCategory: "furniture", listingImageUrl: photos[0], lastMessageBody: "Yes, come by at 5.", lastMessageIsMine: true },
    ],
  );
  // The same last message, seen from the other side.
  const buyerLamp = buyerRows.find((row) => row.listingId === lamp.id);
  assert.equal(buyerLamp.lastMessageBody, "Yes, come by at 5.");
  assert.equal(buyerLamp.lastMessageIsMine, false);
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

test("a message to nobody is 404, and ids that are not ids are 400, never 500", async () => {
  const [owner, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  const toNobody = await send(owner, { id: randomUUID() }, listing, "Hello?");
  assert.equal(toNobody.status, 404);
  assert.equal(toNobody.body.error, "User not found.");
  // Not UUIDs, or missing: refused before the database sees them.
  assert.equal((await send(owner, { id: "abc" }, listing, "Hi")).status, 400);
  assert.equal((await send(owner, {}, listing, "Hi")).status, 400);
  assert.equal((await send(buyer, owner, { id: "abc" }, "Hi")).status, 400);
  assert.equal((await send(buyer, owner, {}, "Hi")).status, 400);
  // A well-formed id of no listing is still 404.
  assert.equal((await send(buyer, owner, { id: randomUUID() }, "Hi")).status, 404);
});

test("you cannot message yourself, and empty messages are refused", async () => {
  const [owner, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  assert.equal((await send(owner, owner, listing, "Note to self")).status, 400);
  assert.equal((await send(buyer, owner, listing, "   ")).status, 400);
});

test("the live stream needs a login, and takes both thread params or neither", async () => {
  assert.equal((await api.request("GET", "/api/messages/stream")).status, 401);
  const user = await api.createUser();
  const onlyListing = await api.request("GET", `/api/messages/stream?listingId=${randomUUID()}`, { token: user.token });
  assert.equal(onlyListing.status, 400);
});

test("both people in a thread get a new message live, and nobody else does", async () => {
  const [owner, buyer, stranger] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  const listing = await api.createListing(owner);
  const streams = await Promise.all([
    openStream(owner),
    openStream(buyer, { listingId: listing.id, withUserId: owner.id }),
    openStream(stranger),
  ]);
  const [ownerStream, buyerStream, strangerStream] = streams;
  try {
    const sent = (await send(buyer, owner, listing, "Is it still available?")).body.message;
    assert.deepEqual(await ownerStream.next(), sent);
    assert.deepEqual(await buyerStream.next(), sent);

    // The stranger's first event is their own message, so the buyer's never reached them.
    const own = (await send(stranger, owner, listing, "Can I see it today?")).body.message;
    assert.deepEqual(await strangerStream.next(), own);
  } finally {
    for (const stream of streams) stream.close();
  }
});

test("a stream for one thread skips the student's other threads", async () => {
  const [owner, buyer] = await Promise.all([api.createUser(), api.createUser()]);
  const [lamp, bike] = await Promise.all([api.createListing(owner), api.createListing(owner)]);
  const lampThread = await openStream(buyer, { listingId: lamp.id, withUserId: owner.id });
  try {
    await send(owner, buyer, bike, "The bike is sold, sorry.");
    const aboutLamp = (await send(owner, buyer, lamp, "The lamp is still here.")).body.message;
    assert.deepEqual(await lampThread.next(), aboutLamp);
  } finally {
    lampThread.close();
  }
});

test("a closed stream is removed from the hub", async () => {
  const user = await api.createUser();
  const before = streamCount();
  const stream = await openStream(user);
  assert.equal(streamCount(), before + 1);
  stream.close();
  await waitFor(() => streamCount() === before);
});

test("no new-message email while the receiver has that thread open; the inbox stream does not count", async () => {
  const [owner, buyer] = await Promise.all([api.createUser("Live Owner"), api.createUser("Live Buyer")]);
  const tag = randomUUID().slice(0, 8);
  const watched = await api.createListing(owner, { title: `Watched lamp ${tag}` });
  const unwatched = await api.createListing(owner, { title: `Unwatched lamp ${tag}` });
  // The owner has the watched thread open, and also the inbox, which is not watching a thread.
  const streams = await Promise.all([
    openStream(owner, { listingId: watched.id, withUserId: buyer.id }),
    openStream(owner),
  ]);
  try {
    await send(buyer, owner, watched, "Is the lamp free?");
    await send(buyer, owner, unwatched, "And this one?");
    const emailsAbout = (title) =>
      api.skippedEmails().filter((line) => line.includes(`"${title}"`) && line.endsWith(` to ${owner.email}`));
    await waitFor(() => emailsAbout(unwatched.title).length === 1);
    assert.equal(emailsAbout(watched.title).length, 0);
  } finally {
    for (const stream of streams) stream.close();
  }
});
