import { buildBrowseQuery, LISTING_SELECT } from "./listings.js";
import { query, withTransaction } from "./pool.js";
import { MAX_BROWSE_LIMIT, parseListingFilters } from "../utils/validation.js";

// The Telegram bot's database queries (utils/telegramBot.js). Every query about "your" things takes
// the id of the student the chat is linked to (findChatUser), never an id from a button.

/** Search results and Newest show this many listings per screen. */
export const PAGE_SIZE = 5;
/** Saved and My listings show at most this many. */
export const LIST_SIZE = 10;

/** The verified student this chat is linked to, or null. */
export async function findChatUser(chatId) {
  const { rows } = await query(
    "SELECT id, name FROM users WHERE telegram_chat_id = $1 AND is_verified", [chatId]);
  return rows[0] ?? null;
}

/**
 * Links the chat to the account whose one-time code this is (from Settings), and returns that
 * student's name, or null if the code is unknown or used. A chat belongs to one account only: any
 * other account linked to this chat is unlinked, so findChatUser never finds two students.
 */
export function linkChat(code, chatId) {
  return withTransaction(async (client) => {
    const { rows: [user] } = await client.query(
      `UPDATE users SET telegram_chat_id = $2, telegram_link_code = NULL
       WHERE telegram_link_code = $1 RETURNING id, name`,
      [code, chatId],
    );
    if (!user) return null;
    await client.query(
      "UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id = $1 AND id <> $2", [chatId, user.id]);
    return user.name;
  });
}

/**
 * One page of active listings for a search term, found and ranked like the website's search
 * (buildBrowseQuery). It asks for one row more than the page needs, to know whether a next page
 * exists (`hasMore`). The website's search returns at most 100 listings, so the pages stop there too.
 */
export async function searchListings(term, page) {
  const shown = page * PAGE_SIZE;
  const filters = { ...parseListingFilters({ query: term }), limit: Math.min(shown + 1, MAX_BROWSE_LIMIT) };
  const { text, params } = buildBrowseQuery(filters);
  const { rows } = await query(text, params);
  return { listings: rows.slice(shown - PAGE_SIZE, shown), hasMore: rows.length > shown };
}

/** The newest active listings, as on the website's home page. */
export async function newestListings() {
  const { text, params } = buildBrowseQuery({ ...parseListingFilters({}), limit: PAGE_SIZE });
  return (await query(text, params)).rows;
}

export async function isSaved(userId, listingId) {
  const { rows } = await query(
    "SELECT 1 FROM saved_listings WHERE user_id = $1 AND listing_id = $2", [userId, listingId]);
  return rows.length > 0;
}

/** The student's saved listings, most recently saved first, in any status (like the Saved page). */
export async function savedListings(userId) {
  const { rows } = await query(
    `${LISTING_SELECT}
     JOIN saved_listings s ON s.listing_id = l.id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT $2`,
    [userId, LIST_SIZE],
  );
  return rows;
}

/**
 * The student's own listings that are still on offer (active or reserved), newest first, each with
 * how many offers wait for their answer (waiting_offers).
 */
export async function myListings(userId) {
  const { rows } = await query(
    `SELECT mine.*,
            (SELECT COUNT(*)::int FROM offers o
             WHERE o.listing_id = mine.id AND o.status = 'pending') AS waiting_offers
     FROM (${LISTING_SELECT}
           WHERE l.user_id = $1 AND l.status IN ('active', 'reserved')
           ORDER BY l.created_at DESC
           LIMIT $2) mine
     ORDER BY mine.created_at DESC`,
    [userId, LIST_SIZE],
  );
  return rows;
}

/**
 * The student's conversations with unread messages, newest first: who wrote, about which listing,
 * and how many are unread. As in routes/messages.js, a conversation is every message between two
 * students about one listing, and a message is unread until read_at is set. This only reads: it
 * never marks anything as read.
 */
export async function unreadConversations(userId) {
  const { rows } = await query(
    `SELECT u.name AS partner_name, l.title AS listing_title, COUNT(*)::int AS unread_count
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     JOIN listings l ON l.id = m.listing_id
     WHERE m.receiver_id = $1 AND m.read_at IS NULL
     GROUP BY m.listing_id, m.sender_id, u.name, l.title
     ORDER BY MAX(m.created_at) DESC`,
    [userId],
  );
  return rows;
}
