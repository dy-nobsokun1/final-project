import { query } from "./pool.js";

// Queries for meetups (routes/meetups.js, and the reminder check in server.js).
// A thread is a listing and two people, whichever of them proposed, so every query matches the
// pair in both directions.

/** SQL for "this meetup is between $2 and $3", whoever proposed it. */
const BETWEEN = "((proposer_id = $2 AND invitee_id = $3) OR (proposer_id = $3 AND invitee_id = $2))";

/** The newest meetup in the thread between `userId` and `otherUserId` about a listing, or null. */
export async function findThreadMeetup(listingId, userId, otherUserId) {
  const { rows } = await query(
    `SELECT * FROM meetups WHERE listing_id = $1 AND ${BETWEEN}
     ORDER BY created_at DESC LIMIT 1`,
    [listingId, userId, otherUserId],
  );
  return rows[0] ?? null;
}

/** Whether the two people have at least one chat message about the listing, in either direction. */
export async function haveMessaged(client, listingId, userId, otherUserId) {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM messages WHERE listing_id = $1
         AND ((sender_id = $2 AND receiver_id = $3) OR (sender_id = $3 AND receiver_id = $2))
     ) AS found`,
    [listingId, userId, otherUserId],
  );
  return rows[0].found;
}

/**
 * The thread's open meetup: the proposal waiting for an answer, or an accepted meetup still to
 * come, or null. An accepted meetup whose time has passed no longer counts.
 */
export async function findOpenMeetup(client, listingId, userId, otherUserId) {
  const { rows } = await client.query(
    `SELECT * FROM meetups WHERE listing_id = $1 AND ${BETWEEN}
       AND (status = 'proposed' OR (status = 'accepted' AND meet_at > now()))
     ORDER BY created_at DESC LIMIT 1`,
    [listingId, userId, otherUserId],
  );
  return rows[0] ?? null;
}

/** How long before an accepted meetup its reminder goes out. */
export const REMINDER_MINUTES = 30;

/**
 * Picks the accepted meetups that start within REMINDER_MINUTES and marks them reminded, in one
 * statement, so a reminder is never sent twice, even if the API restarts or two checks overlap.
 * A meetup accepted less than 30 minutes before its time is picked at the next check.
 * server.js calls this once a minute and sends a reminder for each row it returns.
 */
export async function claimDueReminders() {
  const { rows } = await query(
    `UPDATE meetups SET reminded_at = now()
     WHERE status = 'accepted' AND reminded_at IS NULL
       AND meet_at <= now() + make_interval(mins => $1) AND meet_at > now()
     RETURNING *`,
    [REMINDER_MINUTES],
  );
  return rows;
}
