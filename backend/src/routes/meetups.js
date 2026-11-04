import { Router } from "express";
import { findOpenMeetup, findThreadMeetup, haveMessaged } from "../db/meetups.js";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";
import { isWatchingThread, publishMeetup } from "../utils/liveHub.js";
import { MEETUP_SPOTS, meetupTimeError, toMeetup } from "../utils/meetups.js";
import { notifyMeetupChanged } from "../utils/notify.js";
import { isUuid } from "../utils/validation.js";

// Meetups: in a chat thread, one person proposes a campus spot and a time; the other accepts or
// declines; either can cancel. Both get a reminder 30 minutes before (server.js). A thread is a
// listing and two people, one of them its owner, as for messages (routes/messages.js).
export const meetupsRouter = Router();
meetupsRouter.use(requireAuth);

/**
 * Tells the other person about a new or changed meetup: live on their open streams, and by email
 * and Telegram unless they have this thread open (they see the card change there, as with messages).
 */
function announce(meetup, actorId) {
  publishMeetup(meetup);
  const otherId = actorId === meetup.proposerId ? meetup.inviteeId : meetup.proposerId;
  if (!isWatchingThread(otherId, meetup.listingId, actorId)) notifyMeetupChanged(meetup, actorId);
}

// GET /api/meetups?listingId=&withUserId=  -> { meetup }: the thread's newest meetup, or null.
// Only ever a meetup the signed-in user is part of.
meetupsRouter.get("/", async (req, res) => {
  const { listingId, withUserId } = req.query;
  if (!isUuid(listingId) || !isUuid(withUserId)) throw new HttpError(400, "listingId and withUserId are required.");
  const row = await findThreadMeetup(listingId, req.userId, withUserId);
  res.json({ meetup: row ? toMeetup(row) : null });
});

const MAX_PROPOSALS_PER_HOUR = 10;

// POST /api/meetups  { listingId, withUserId, spot, meetAt }  -> 201 { meetup }
// 429 after 10 proposals by the same person in the last hour.
meetupsRouter.post("/", async (req, res) => {
  const { listingId, withUserId, spot, meetAt } = req.body ?? {};
  if (!isUuid(listingId) || !isUuid(withUserId)) throw new HttpError(400, "listingId and withUserId are required.");
  if (withUserId === req.userId) throw new HttpError(400, "You cannot plan a meetup with yourself.");
  if (typeof spot !== "string" || !Object.hasOwn(MEETUP_SPOTS, spot)) {
    throw new HttpError(400, "Pick a meetup spot from the list.", { spot: "Pick a spot from the list." });
  }
  const timeError = meetupTimeError(meetAt);
  if (timeError) throw new HttpError(400, timeError, { meetAt: timeError });
  // Each proposal emails the other person, so at most 10 an hour. Counted in the database (so a
  // restart does not reset it), replaced and cancelled proposals included: they were sent too.
  const { rows: [recent] } = await query(
    "SELECT count(*)::int AS n FROM meetups WHERE proposer_id = $1 AND created_at > now() - interval '1 hour'",
    [req.userId],
  );
  if (recent.n >= MAX_PROPOSALS_PER_HOUR) {
    throw new HttpError(429, `You have planned ${MAX_PROPOSALS_PER_HOUR} meetups this hour. Try again later.`);
  }

  const meetup = await withTransaction(async (client) => {
    // Locking the listing row makes two quick taps in one thread wait for each other, so the
    // second replaces the first instead of both being saved.
    const { rows: [listing] } = await client.query("SELECT user_id FROM listings WHERE id = $1 FOR UPDATE", [listingId]);
    if (!listing) throw new HttpError(404, "Listing not found.");
    if (listing.user_id !== req.userId && listing.user_id !== withUserId) {
      throw new HttpError(403, "A meetup must include the listing's owner.");
    }
    // Checked in the database, so naming any student as withUserId is not enough.
    if (!(await haveMessaged(client, listingId, req.userId, withUserId))) {
      throw new HttpError(403, "Send a message in this chat before planning a meetup.");
    }
    const open = await findOpenMeetup(client, listingId, req.userId, withUserId);
    if (open?.status === "accepted") {
      throw new HttpError(409, "You already have an accepted meetup in this chat. Cancel it first to plan a new one.");
    }
    if (open) {
      // A new proposal replaces the one still waiting for an answer.
      const cancelled = await client.query(
        "UPDATE meetups SET status = 'cancelled', updated_at = now() WHERE id = $1 AND status = 'proposed'", [open.id]);
      if (cancelled.rowCount === 0) throw new HttpError(409, "The meetup just changed. Please try again.");
    }
    const { rows: [created] } = await client.query(
      `INSERT INTO meetups (listing_id, proposer_id, invitee_id, spot, meet_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [listingId, req.userId, withUserId, spot, new Date(meetAt)],
    );
    return toMeetup(created);
  });

  // Only after the transaction is saved.
  announce(meetup, req.userId);
  res.status(201).json({ meetup });
});

// Who may move a meetup to each status, from which status. Each is one conditional UPDATE, so two
// people answering at once cannot both win. Only these fixed strings are ever built into the SQL.
const CHANGES = {
  accepted: "status = 'proposed' AND invitee_id = $2 AND meet_at > now()",
  declined: "status = 'proposed' AND invitee_id = $2",
  cancelled: "status IN ('proposed', 'accepted') AND $2 IN (proposer_id, invitee_id)",
};

// PATCH /api/meetups/:id  { status: "accepted" | "declined" | "cancelled" }  -> { meetup }
meetupsRouter.patch("/:id", async (req, res) => {
  const { status } = req.body ?? {};
  if (!Object.hasOwn(CHANGES, status ?? "")) {
    throw new HttpError(400, "Status must be accepted, declined or cancelled.");
  }
  if (!isUuid(req.params.id)) throw new HttpError(404, "Meetup not found.");
  const { rows: [updated] } = await query(
    `UPDATE meetups SET status = $3, updated_at = now() WHERE id = $1 AND ${CHANGES[status]} RETURNING *`,
    [req.params.id, req.userId, status],
  );
  if (!updated) throw await whyUnchanged(req.params.id, req.userId, status);

  const meetup = toMeetup(updated);
  announce(meetup, req.userId);
  res.json({ meetup });
});

/** The error for a PATCH that changed nothing, worked out from the meetup as it is now. */
async function whyUnchanged(id, userId, status) {
  const { rows: [row] } = await query("SELECT * FROM meetups WHERE id = $1", [id]);
  if (!row || (row.proposer_id !== userId && row.invitee_id !== userId)) return new HttpError(404, "Meetup not found.");
  if (status !== "cancelled" && row.invitee_id !== userId) {
    return new HttpError(403, "Only the person invited can accept or decline this meetup.");
  }
  if (status === "accepted" && row.status === "proposed") {
    return new HttpError(409, "That time has passed. Plan a new meetup.");
  }
  return new HttpError(409, `This meetup was already ${row.status}.`);
}
