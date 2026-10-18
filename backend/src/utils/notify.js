import { config } from "../config.js";
import { query } from "../db/pool.js";
import { isTelegramConfigured, sendTelegramMessage } from "../services/telegram.js";
import { escapeHtml, isEmailConfigured, sendEmail } from "./email.js";

// Notifications by email, and by Telegram for users who connected it in Settings.
// Every function here is "fire and forget": routes call it without `await`, and it never throws,
// so a mail or Telegram problem can never break sending a message, placing a bid or paying.

const PREVIEW_LENGTH = 200;

/** Builds a link into the web app, e.g. appLink("/listings/abc"). */
function appLink(path) {
  return `${config.frontendOrigin}${path}`;
}

/** The thread URL the frontend uses: /messages/<listingId>_<otherPersonId>. */
function threadLink(listingId, otherUserId) {
  return appLink(`/messages/${listingId}_${otherUserId}`);
}

/** "$30" or "$30.50", whether the amount arrives as a number or as PostgreSQL's "30.00". */
function money(amount) {
  const value = Number(amount);
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

function preview(text) {
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}...` : text;
}

async function findUser(id) {
  const { rows } = await query("SELECT name, email, telegram_chat_id FROM users WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/**
 * Sends one notification to a user (a row from findUser) by email, and by Telegram if they
 * connected it. `lines` are plain text: escaped for the email's HTML, sent as-is to Telegram.
 */
async function deliver({ to, subject, lines, link, linkLabel }) {
  await Promise.all([emailTo(to, { subject, lines, link, linkLabel }), telegramTo(to, { subject, lines, link })]);
}

async function emailTo(user, { subject, lines, link, linkLabel }) {
  if (!isEmailConfigured) {
    console.log(`[notify] email not configured, skipped "${subject}" to ${user.email}`);
    return;
  }
  try {
    await sendEmail({
      to: user.email,
      subject,
      text: `${lines.join("\n\n")}\n\n${linkLabel}: ${link}`,
      html: `${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n")}
<p><a href="${link}">${escapeHtml(linkLabel)}</a></p>`,
    });
  } catch (error) {
    console.error(`[notify] could not email ${user.email} ("${subject}"): ${error.response ?? error.message}`);
  }
}

async function telegramTo(user, { subject, lines, link }) {
  if (!isTelegramConfigured || !user.telegram_chat_id) return;
  try {
    // The first line is the "Hi <name>," greeting, which reads oddly in a chat, so it is dropped.
    await sendTelegramMessage(user.telegram_chat_id, [subject, ...lines.slice(1), link].join("\n\n"));
  } catch (error) {
    console.error(`[notify] could not send Telegram message ("${subject}"): ${error.message}`);
  }
}

/** Runs a notification in the background and logs anything unexpected instead of throwing. */
function inBackground(work) {
  void work().catch((error) => console.error("[notify] failed:", error.message));
}

/**
 * New chat message. Only the first unread message in a thread sends an email, so a burst of
 * messages produces one email, not ten. Reading the thread "re-arms" it.
 */
export function notifyNewMessage({ listingId, senderId, receiverId, body }) {
  inBackground(async () => {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS unread, (SELECT title FROM listings WHERE id = $1) AS title
       FROM messages
       WHERE listing_id = $1 AND sender_id = $2 AND receiver_id = $3 AND read_at IS NULL`,
      [listingId, senderId, receiverId],
    );
    if (rows[0].unread !== 1) return;
    const [sender, receiver] = await Promise.all([findUser(senderId), findUser(receiverId)]);
    if (!sender || !receiver) return;
    await deliver({
      to: receiver,
      subject: `New message from ${sender.name} about "${rows[0].title}"`,
      lines: [`Hi ${receiver.name},`, `${sender.name} wrote:`, `"${preview(body)}"`],
      link: threadLink(listingId, senderId),
      linkLabel: "Reply on UniSwap",
    });
  });
}

/** Someone placed a higher bid than `previousBidderId`. */
export function notifyOutbid({ listingId, previousBidderId, amount }) {
  inBackground(async () => {
    const [bidder, listing] = await Promise.all([
      findUser(previousBidderId),
      query("SELECT title FROM listings WHERE id = $1", [listingId]).then((r) => r.rows[0]),
    ]);
    if (!bidder || !listing) return;
    await deliver({
      to: bidder,
      subject: `You've been outbid on "${listing.title}"`,
      lines: [`Hi ${bidder.name},`, `Someone bid ${money(amount)} on "${listing.title}", so you are no longer the highest bidder.`],
      link: appLink(`/listings/${listingId}`),
      linkLabel: "Bid again",
    });
  });
}

/** An auction ended with bids: tell the winner and the seller (row from closeEndedAuctions). */
export function notifyAuctionClosed({ listing_id: listingId, title, seller_id: sellerId, winner_id: winnerId, amount }) {
  inBackground(async () => {
    const [seller, winner] = await Promise.all([findUser(sellerId), findUser(winnerId)]);
    if (!seller || !winner) return;
    await Promise.all([
      deliver({
        to: winner,
        subject: `You won "${title}" for ${money(amount)}`,
        lines: [`Hi ${winner.name},`, `Your bid of ${money(amount)} won the auction for "${title}".`,
          `Message ${seller.name} to arrange a time and place to meet on campus.`],
        link: threadLink(listingId, sellerId),
        linkLabel: `Message ${seller.name}`,
      }),
      deliver({
        to: seller,
        subject: `Your auction "${title}" ended at ${money(amount)}`,
        lines: [`Hi ${seller.name},`, `${winner.name} won "${title}" with a bid of ${money(amount)}.`,
          "The listing is now reserved for them. Message them to arrange the handover."],
        link: threadLink(listingId, winnerId),
        linkLabel: `Message ${winner.name}`,
      }),
    ]);
  });
}

/** An online payment (card or KHQR) went through: tell the seller to hand the item over, and give the buyer a receipt. */
export function notifyPaid({ listing_id: listingId, buyer_id: buyerId, amount }) {
  inBackground(async () => {
    const { rows } = await query("SELECT title, user_id FROM listings WHERE id = $1", [listingId]);
    if (!rows[0]) return;
    const { title, user_id: sellerId } = rows[0];
    const [buyer, seller] = await Promise.all([findUser(buyerId), findUser(sellerId)]);
    if (!buyer || !seller) return;
    await Promise.all([
      deliver({
        to: seller,
        subject: `${buyer.name} paid ${money(amount)} for "${title}"`,
        lines: [`Hi ${seller.name},`, `${buyer.name} paid ${money(amount)} online for "${title}". It is now marked sold.`,
          "Message them to arrange the handover on campus."],
        link: threadLink(listingId, buyerId),
        linkLabel: `Message ${buyer.name}`,
      }),
      deliver({
        to: buyer,
        subject: `Payment received: "${title}"`,
        lines: [`Hi ${buyer.name},`, `Your payment of ${money(amount)} for "${title}" went through.`,
          `Message ${seller.name} to arrange the handover on campus.`],
        link: threadLink(listingId, sellerId),
        linkLabel: `Message ${seller.name}`,
      }),
    ]);
  });
}

/** A payment arrived after the item was already sold (see markPaid): the buyer must be refunded. */
export function notifyLatePayment({ listing_id: listingId, buyer_id: buyerId, amount }) {
  inBackground(async () => {
    const { rows } = await query("SELECT title, user_id FROM listings WHERE id = $1", [listingId]);
    if (!rows[0]) return;
    const { title, user_id: sellerId } = rows[0];
    const [buyer, seller] = await Promise.all([findUser(buyerId), findUser(sellerId)]);
    if (!buyer || !seller) return;
    await Promise.all([
      deliver({
        to: seller,
        subject: `Refund needed: ${buyer.name} paid ${money(amount)} for "${title}"`,
        lines: [`Hi ${seller.name},`,
          `${buyer.name}'s payment of ${money(amount)} for "${title}" arrived after the item was already sold.`,
          `Please send the ${money(amount)} back to ${buyer.name}, and message them to confirm.`],
        link: threadLink(listingId, buyerId),
        linkLabel: `Message ${buyer.name}`,
      }),
      deliver({
        to: buyer,
        subject: `Your payment for "${title}" arrived after it was sold`,
        lines: [`Hi ${buyer.name},`,
          `Your payment of ${money(amount)} for "${title}" went through, but the item had already been sold.`,
          `${seller.name} has been asked to refund you. Message them if you have not heard back.`],
        link: threadLink(listingId, sellerId),
        linkLabel: `Message ${seller.name}`,
      }),
    ]);
  });
}
