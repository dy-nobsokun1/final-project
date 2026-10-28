import { Router } from "express";
import { findListingById } from "../db/listings.js";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";
import { notifyNewMessage } from "../utils/notify.js";
import { toMessage } from "../utils/serializers.js";

// Messaging follows the ER diagram: each message has a listing, a sender and a receiver.
// A "conversation" is not stored; it is every message between two users about one listing.
export const messagesRouter = Router();
messagesRouter.use(requireAuth);

// GET /api/messages/conversations  -> my chat threads, newest first, each with its listing's title,
// category and cover photo and the newest message, all in one query (the inbox shows them per row)
messagesRouter.get("/conversations", async (req, res) => {
  const { rows } = await query(
    `WITH mine AS (
       SELECT m.*, CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS partner_id
       FROM messages m
       WHERE m.sender_id = $1 OR m.receiver_id = $1
     ),
     threads AS (
       SELECT listing_id, partner_id,
              MAX(created_at) AS last_message_at,
              COUNT(*) FILTER (WHERE receiver_id = $1 AND read_at IS NULL)::int AS unread_count
       FROM mine
       GROUP BY listing_id, partner_id
     )
     SELECT t.*, l.title AS listing_title, l.category AS listing_category,
            l.image_urls[1] AS listing_image_url, -- SQL arrays start at 1: this is the cover photo
            last.content AS last_message_body, last.sender_id = $1 AS last_message_is_mine
     FROM threads t
     JOIN listings l ON l.id = t.listing_id
     -- The newest message of each thread (LATERAL runs this once per thread row).
     CROSS JOIN LATERAL (
       SELECT content, sender_id FROM mine
       WHERE mine.listing_id = t.listing_id AND mine.partner_id = t.partner_id
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) last
     ORDER BY t.last_message_at DESC`,
    [req.userId],
  );
  res.json({
    conversations: rows.map((row) => ({
      listingId: row.listing_id,
      partnerId: row.partner_id,
      participantIds: [req.userId, row.partner_id],
      lastMessageAt: row.last_message_at,
      unreadCount: row.unread_count,
      listingTitle: row.listing_title,
      listingCategory: row.listing_category,
      listingImageUrl: row.listing_image_url,
      lastMessageBody: row.last_message_body,
      lastMessageIsMine: row.last_message_is_mine,
    })),
  });
});

// GET /api/messages?listingId=&withUserId=  -> one thread, oldest first
messagesRouter.get("/", async (req, res) => {
  const { listingId, withUserId } = req.query;
  if (!listingId || !withUserId) throw new HttpError(400, "listingId and withUserId are required.");
  const { rows } = await query(
    `SELECT * FROM messages
     WHERE listing_id = $1
       AND ((sender_id = $2 AND receiver_id = $3) OR (sender_id = $3 AND receiver_id = $2))
     ORDER BY created_at ASC`,
    [listingId, req.userId, withUserId],
  );
  res.json({ messages: rows.map(toMessage) });
});

// POST /api/messages  { listingId, receiverId, body }
messagesRouter.post("/", async (req, res) => {
  const { listingId, receiverId, body } = req.body;
  if (typeof body !== "string" || !body.trim() || body.length > 2000) {
    throw new HttpError(400, "Message must be 1-2000 characters.");
  }
  if (receiverId === req.userId) throw new HttpError(400, "You cannot message yourself.");

  const listing = await findListingById(listingId);
  if (!listing) throw new HttpError(404, "Listing not found.");
  // Every chat is between the listing's owner and one other person.
  if (listing.user_id !== req.userId && listing.user_id !== receiverId) {
    throw new HttpError(400, "Messages about a listing must include its owner.");
  }

  const { rows } = await query(
    `INSERT INTO messages (listing_id, sender_id, receiver_id, content)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [listingId, req.userId, receiverId, body.trim()],
  );
  notifyNewMessage({ listingId, senderId: req.userId, receiverId, body: body.trim() });
  res.status(201).json({ message: toMessage(rows[0]) });
});

// PATCH /api/messages/read  { listingId, withUserId }  -> mark a thread as read
messagesRouter.patch("/read", async (req, res) => {
  const { listingId, withUserId } = req.body;
  const result = await query(
    `UPDATE messages SET read_at = now()
     WHERE listing_id = $1 AND sender_id = $2 AND receiver_id = $3 AND read_at IS NULL`,
    [listingId, withUserId, req.userId],
  );
  res.json({ markedRead: result.rowCount });
});
