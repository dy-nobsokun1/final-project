import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { startApi, waitFor } from "./helpers.js";

const api = await startApi();
// Imported after startApi, so it uses the test database.
const { claimDueReminders } = await import("../../src/db/meetups.js");
const { toMeetup } = await import("../../src/utils/meetups.js");
const { notifyMeetupReminder } = await import("../../src/utils/notify.js");
after(() => api.close());

const inHours = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

/** An owner, a buyer who already messaged them about a fresh listing, and the listing. */
async function thread(title = `Lamp ${randomUUID().slice(0, 8)}`) {
  const [owner, buyer] = await Promise.all([api.createUser("Meet Owner"), api.createUser("Meet Buyer")]);
  const listing = await api.createListing(owner, { title });
  const sent = await api.request("POST", "/api/messages", {
    token: buyer.token,
    body: { listingId: listing.id, receiverId: owner.id, body: "Can we meet?" },
  });
  assert.equal(sent.status, 201);
  return { owner, buyer, listing };
}

function propose(from, to, listing, fields = {}) {
  return api.request("POST", "/api/meetups", {
    token: from.token,
    body: { listingId: listing.id, withUserId: to.id, spot: "library_entrance", meetAt: inHours(3), ...fields },
  });
}

function answer(user, meetup, status) {
  return api.request("PATCH", `/api/meetups/${meetup.id}`, { token: user.token, body: { status } });
}

function threadMeetup(user, other, listing) {
  return api.request("GET", `/api/meetups?listingId=${listing.id}&withUserId=${other.id}`, { token: user.token });
}

test("either person in a chat can propose a meetup, and both see it", async () => {
  const { owner, buyer, listing } = await thread();
  const made = await propose(buyer, owner, listing);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  assert.equal(made.body.meetup.status, "proposed");
  assert.equal(made.body.meetup.proposerId, buyer.id);
  assert.equal(made.body.meetup.inviteeId, owner.id);
  assert.deepEqual((await threadMeetup(owner, buyer, listing)).body.meetup, made.body.meetup);
  assert.deepEqual((await threadMeetup(buyer, owner, listing)).body.meetup, made.body.meetup);

  // The owner can propose too (it replaces the buyer's proposal).
  assert.equal((await propose(owner, buyer, listing)).status, 201);
});

test("only the owner and someone who already chatted with them may plan a meetup", async () => {
  const { owner, buyer, listing } = await thread();
  const stranger = await api.createUser();
  // No message with the owner yet.
  assert.equal((await propose(stranger, owner, listing)).status, 403);
  // Neither person is the owner.
  assert.equal((await propose(stranger, buyer, listing)).status, 403);
  // Not with yourself, and not about a listing that does not exist.
  assert.equal((await propose(owner, owner, listing)).status, 400);
  assert.equal((await propose(buyer, owner, { id: randomUUID() })).status, 404);
  // The stranger cannot read the thread's meetup either.
  await propose(buyer, owner, listing);
  assert.equal((await threadMeetup(stranger, owner, listing)).body.meetup, null);
});

test("the spot must be on the list, and the time in the next 14 days", async () => {
  const { owner, buyer, listing } = await thread();
  assert.equal((await propose(buyer, owner, listing, { spot: "my dorm room" })).status, 400);
  assert.equal((await propose(buyer, owner, listing, { meetAt: inHours(-1) })).status, 400);
  assert.equal((await propose(buyer, owner, listing, { meetAt: inHours(15 * 24) })).status, 400);
  assert.equal((await propose(buyer, owner, listing, { meetAt: "tomorrow" })).status, 400);
  assert.equal((await propose(buyer, owner, listing, { meetAt: inHours(13 * 24) })).status, 201);
});

test("a new proposal replaces the old one, even when two arrive at once", async () => {
  const { owner, buyer, listing } = await thread();
  const first = (await propose(buyer, owner, listing)).body.meetup;
  const second = (await propose(buyer, owner, listing, { spot: "cafeteria" })).body.meetup;
  const [{ status }] = await api.sql("SELECT status FROM meetups WHERE id = $1", [first.id]);
  assert.equal(status, "cancelled");
  assert.equal((await threadMeetup(owner, buyer, listing)).body.meetup.id, second.id);
  // The replaced one can no longer be accepted.
  assert.equal((await answer(owner, first, "accepted")).status, 409);

  // Two quick taps: both succeed, one after the other, and only one proposal stays open.
  const taps = await Promise.all([propose(buyer, owner, listing), propose(owner, buyer, listing)]);
  assert.deepEqual(taps.map((tap) => tap.status), [201, 201]);
  const open = await api.sql("SELECT id FROM meetups WHERE listing_id = $1 AND status = 'proposed'", [listing.id]);
  assert.equal(open.length, 1);
});

test("only the invitee accepts or declines; either person can cancel", async () => {
  const { owner, buyer, listing } = await thread();
  const meetup = (await propose(buyer, owner, listing)).body.meetup;
  assert.equal((await answer(buyer, meetup, "accepted")).status, 403);
  assert.equal((await answer(buyer, meetup, "declined")).status, 403);
  assert.equal((await answer(owner, meetup, "maybe")).status, 400);
  const stranger = await api.createUser();
  assert.equal((await answer(stranger, meetup, "cancelled")).status, 404);

  const accepted = await answer(owner, meetup, "accepted");
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.meetup.status, "accepted");
  // While it is on, a new proposal is refused: cancel it first.
  assert.equal((await propose(buyer, owner, listing)).status, 409);
  assert.equal((await answer(owner, meetup, "declined")).status, 409);
  // Either person can cancel an accepted meetup, once.
  assert.equal((await answer(buyer, meetup, "cancelled")).body.meetup.status, "cancelled");
  assert.equal((await answer(owner, meetup, "cancelled")).status, 409);
  assert.equal((await propose(buyer, owner, listing)).status, 201);

  const next = (await threadMeetup(owner, buyer, listing)).body.meetup;
  assert.equal((await answer(owner, next, "declined")).body.meetup.status, "declined");
  assert.equal((await answer(owner, next, "accepted")).status, 409);
});

test("a proposal whose time has passed cannot be accepted", async () => {
  const { owner, buyer, listing } = await thread();
  const meetup = (await propose(buyer, owner, listing)).body.meetup;
  await api.sql("UPDATE meetups SET meet_at = now() - interval '1 minute' WHERE id = $1", [meetup.id]);
  const late = await answer(owner, meetup, "accepted");
  assert.equal(late.status, 409);
  assert.match(late.body.error, /time has passed/);
});

test("an accepted meetup whose time has passed no longer blocks a new one", async () => {
  const { owner, buyer, listing } = await thread();
  const meetup = (await propose(buyer, owner, listing)).body.meetup;
  assert.equal((await answer(owner, meetup, "accepted")).status, 200);
  await api.sql("UPDATE meetups SET meet_at = now() - interval '1 hour' WHERE id = $1", [meetup.id]);
  // The thread page shows it as past and offers "Plan meetup" again (MeetupCard, isMeetupPast).
  const next = await propose(owner, buyer, listing);
  assert.equal(next.status, 201);
  assert.equal((await threadMeetup(buyer, owner, listing)).body.meetup.id, next.body.meetup.id);
});

test("the other person is told about each change by email", async () => {
  const title = `Meetup lamp ${randomUUID().slice(0, 8)}`;
  const { owner, buyer, listing } = await thread(title);
  const emailed = (subject, to) =>
    api.skippedEmails().some((line) => line.includes(subject) && line.includes(title) && line.endsWith(` to ${to.email}`));
  const meetup = (await propose(buyer, owner, listing)).body.meetup;
  await waitFor(() => emailed("wants to meet about", owner));
  await answer(owner, meetup, "accepted");
  await waitFor(() => emailed("accepted your meetup", buyer));
  await answer(owner, meetup, "cancelled");
  await waitFor(() => emailed("cancelled the meetup", buyer));
  const next = (await propose(buyer, owner, listing)).body.meetup;
  await answer(owner, next, "declined");
  await waitFor(() => emailed("declined your meetup", buyer));
});

test("each accepted meetup gets one reminder, 30 minutes before", async () => {
  const title = `Reminder lamp ${randomUUID().slice(0, 8)}`;
  const { owner, buyer, listing } = await thread(title);
  const meetup = (await propose(buyer, owner, listing)).body.meetup;
  await answer(owner, meetup, "accepted");

  // Still 3 hours away: not due yet.
  assert.ok(!(await claimDueReminders()).some((row) => row.id === meetup.id));
  // 20 minutes away: due, and claimed only once.
  await api.sql("UPDATE meetups SET meet_at = now() + interval '20 minutes' WHERE id = $1", [meetup.id]);
  const due = (await claimDueReminders()).find((row) => row.id === meetup.id);
  assert.ok(due);
  assert.ok(!(await claimDueReminders()).some((row) => row.id === meetup.id));
  // What server.js does with each claimed row: both people get the reminder.
  notifyMeetupReminder(toMeetup(due));
  const reminded = (user) => api.skippedEmails().some((line) =>
    line.includes("Reminder:") && line.includes(title) && line.endsWith(` to ${user.email}`));
  await waitFor(() => reminded(owner) && reminded(buyer));
  const [{ reminded_at: remindedAt }] = await api.sql("SELECT reminded_at FROM meetups WHERE id = $1", [meetup.id]);
  assert.ok(remindedAt);

  // A proposal that was never accepted, or a meetup already over, gets none.
  const other = await thread();
  const waiting = (await propose(other.buyer, other.owner, other.listing)).body.meetup;
  await api.sql("UPDATE meetups SET meet_at = now() + interval '10 minutes' WHERE id = $1", [waiting.id]);
  await api.sql(
    `INSERT INTO meetups (listing_id, proposer_id, invitee_id, spot, meet_at, status)
     VALUES ($1, $2, $3, 'cafeteria', now() - interval '5 minutes', 'accepted')`,
    [other.listing.id, other.buyer.id, other.owner.id],
  );
  const claimed = await claimDueReminders();
  assert.ok(!claimed.some((row) => row.listing_id === other.listing.id));
});

test("meetup changes go live to both people's open thread streams as a separate event", async () => {
  const { owner, buyer, listing } = await thread();
  const controller = new AbortController();
  const response = await fetch(
    `${api.baseUrl}/api/messages/stream?listingId=${listing.id}&withUserId=${buyer.id}`,
    { headers: { Authorization: `Bearer ${owner.token}` }, signal: controller.signal },
  );
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    const meetup = (await propose(buyer, owner, listing)).body.meetup;
    let text = "";
    const deadline = Date.now() + 2000;
    while (!text.includes("event: meetup") || !text.includes("\n\n", text.indexOf("event: meetup"))) {
      if (Date.now() > deadline) throw new Error("No meetup event within 2 s.");
      text += (await reader.read()).value;
    }
    const frame = text.slice(text.indexOf("event: meetup")).split("\n\n")[0];
    const data = JSON.parse(frame.split("\n").find((line) => line.startsWith("data: ")).slice(6));
    assert.equal(data.id, meetup.id);
    assert.equal(data.status, "proposed");
    // The owner had the thread open, so no email about it.
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.ok(!api.skippedEmails().some((line) => line.includes("wants to meet") && line.endsWith(` to ${owner.email}`)));
  } finally {
    controller.abort();
  }
});

test("one person can propose at most 10 meetups an hour, counting replaced ones", async () => {
  const { owner, buyer, listing } = await thread();
  // Each new proposal replaces the last one in this chat, but every one of them still counts.
  for (let i = 0; i < 10; i += 1) {
    const made = await propose(buyer, owner, listing);
    assert.equal(made.status, 201, JSON.stringify(made.body));
  }
  const refused = await propose(buyer, owner, listing);
  assert.equal(refused.status, 429);
  assert.equal(refused.body.error, "You have planned 10 meetups this hour. Try again later.");
  // The limit is per person, not per chat: the other person can still propose.
  assert.equal((await propose(owner, buyer, listing)).status, 201);
});
