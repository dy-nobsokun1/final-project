// Meetups: a campus spot and a time two people in a chat thread agree on (routes/meetups.js).

/**
 * The campus spots a meetup can be at: the key is stored, the label is shown and emailed.
 * The frontend has the same list in src/lib/meetup-spots.ts; change both together.
 * Placeholders until the team names AUPP's real spots. Renaming a label needs no database change.
 */
export const MEETUP_SPOTS = {
  library_entrance: "Library entrance",
  cafeteria: "Cafeteria",
  main_gate: "Main gate",
  student_lounge: "Student lounge",
};

export const MEETUP_STATUSES = ["proposed", "accepted", "declined", "cancelled"];

/** How far ahead a meetup can be planned. */
export const MAX_MEETUP_DAYS = 14;

/** An ISO date and time with its zone, like "2026-11-06T15:30:00+07:00", so it means one moment only. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Why `meetAt` (an ISO date string) cannot be a meetup's time, or null if it can. */
export function meetupTimeError(meetAt, now = new Date()) {
  const time = typeof meetAt === "string" && ISO_TIME.test(meetAt) ? new Date(meetAt) : null;
  if (!time || Number.isNaN(time.getTime())) return "Pick a date and time for the meetup.";
  if (time <= now) return "Pick a time in the future.";
  if (time - now > MAX_MEETUP_DAYS * 24 * 60 * 60 * 1000) {
    return `Pick a time within the next ${MAX_MEETUP_DAYS} days.`;
  }
  return null;
}

/** "Fri, Nov 6, 2026, 3:30 PM": a meetup's time in Phnom Penh, for emails and Telegram. */
export function formatMeetupTime(meetAt) {
  return new Date(meetAt).toLocaleString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A meetups row as the API sends it (camelCase, like the frontend's Meetup type). */
export function toMeetup(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    proposerId: row.proposer_id,
    inviteeId: row.invitee_id,
    spot: row.spot,
    meetAt: row.meet_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
