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
  const frame = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
  const sides = [[message.senderId, message.receiverId], [message.receiverId, message.senderId]];
  for (const [userId, partnerId] of sides) {
    for (const stream of streams.get(String(userId)) ?? []) {
      if (stream.listingId && !isThread(stream, message.listingId, partnerId)) continue;
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
