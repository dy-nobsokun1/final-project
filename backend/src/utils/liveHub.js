// Live chat: the open Server-Sent Events streams (GET /api/messages/stream), kept in memory.
// This works because only one API process runs. A second process would not see the first one's
// streams, and would need a shared channel (like Postgres LISTEN/NOTIFY) instead.

/** userId -> Set of { res, listingId, withUserId }. The two ids are null on an inbox stream. */
const streams = new Map();

/** Adds an open stream for `userId` and returns a function that removes it again. */
export function addStream(userId, stream) {
  const key = String(userId);
  if (!streams.has(key)) streams.set(key, new Set());
  streams.get(key).add(stream);
  return () => {
    const set = streams.get(key);
    set?.delete(stream);
    if (set?.size === 0) streams.delete(key);
  };
}

/**
 * Sends `message` (as toMessage returns it) to every open stream of its sender and receiver.
 * A stream that watches one thread only gets that thread's messages.
 */
export function publishMessage(message) {
  publish("message", message, message.listingId, message.senderId, message.receiverId);
}

/**
 * Sends a new or changed meetup (as toMeetup returns it) to both people's streams, as
 * "event: meetup". EventSource's onmessage only sees "message" events, so the message code
 * (use-live-messages, LiveInboxRefresh) ignores it; the thread page listens for it by name.
 */
export function publishMeetup(meetup) {
  publish("meetup", meetup, meetup.listingId, meetup.proposerId, meetup.inviteeId);
}

/** Writes one event to the open streams of the two people in a thread (inbox streams included). */
function publish(event, data, listingId, userId, otherUserId) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [user, partner] of [[userId, otherUserId], [otherUserId, userId]]) {
    for (const stream of streams.get(String(user)) ?? []) {
      if (stream.listingId && !isThread(stream, listingId, partner)) continue;
      if (!stream.res.destroyed) stream.res.write(frame);
    }
  }
}

/** Whether `userId` has the thread with `withUserId` about `listingId` open right now. */
export function isWatchingThread(userId, listingId, withUserId) {
  return [...(streams.get(String(userId)) ?? [])].some((stream) => isThread(stream, listingId, withUserId));
}

/** How many streams are open, for the tests (they check closed streams are removed). */
export function streamCount() {
  let count = 0;
  for (const set of streams.values()) count += set.size;
  return count;
}

function isThread(stream, listingId, withUserId) {
  return stream.listingId === String(listingId) && stream.withUserId === String(withUserId);
}
