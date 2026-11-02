import { findWantedForItem } from "../db/matches.js";
import { query } from "../db/pool.js";
import { isTelegramConfigured, sendTelegramMessage } from "../services/telegram.js";
import { siteOrigin } from "../services/tunnel.js";
import { isEmailConfigured, sendEmail } from "./email.js";
import { renderEmail } from "./notificationEmail.js";
import { renderTelegram } from "./notificationTelegram.js";
import { invoiceNumber } from "./payments.js";
import { publicSiteUrl, shorten } from "./telegramScreens.js";

// Notifications by email, and by Telegram for users who connected it in Settings.
// Every function here is "fire and forget": routes call it without `await`, and it never throws,
// so a mail or Telegram problem can never break sending a message, placing a bid or paying.
//
// Each event describes its message once, as a notification:
//   { subject, preheader?, emoji, heading, intro, details: [[label, value, "code"?]], quote?,
//     action: { label, link }, secondAction?, note? }
// utils/notificationEmail.js and utils/notificationTelegram.js draw it for each channel, so the two
// always say the same thing. Everything typed by a student (names, titles, chat text) is plain text
// here and is escaped by those two files.

const PREVIEW_LENGTH = 200;
const SUBJECT_TITLE_LENGTH = 40;

/** Builds a link into the web app, e.g. appLink("/listings/abc"). */
function appLink(path) {
  return `${siteOrigin()}${path}`;
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

/** A listing title in quotes for a subject line, cut short because phones show only the start of it. */
function quoted(title) {
  return `"${shorten(title, SUBJECT_TITLE_LENGTH)}"`;
}

async function findUser(id) {
  const { rows } = await query("SELECT name, email, telegram_chat_id FROM users WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/** Sends one notification to a user (a row from findUser) by email, and by Telegram if they connected it. */
async function deliver({ to, notification }) {
  await Promise.all([emailTo(to, notification), telegramTo(to, notification)]);
}

async function emailTo(user, notification) {
  if (!isEmailConfigured) {
    console.log(`[notify] email not configured, skipped "${notification.subject}" to ${user.email}`);
    return;
  }
  try {
    await sendEmail({ to: user.email, subject: notification.subject, ...renderEmail(notification, user.name) });
  } catch (error) {
    console.error(`[notify] could not email ${user.email} ("${notification.subject}"): ${error.response ?? error.message}`);
  }
}

async function telegramTo(user, notification) {
  if (!isTelegramConfigured || !user.telegram_chat_id) return;
  const { html, text, buttons } = renderTelegram(notification, publicSiteUrl(siteOrigin()));
  try {
    await sendTelegramMessage(user.telegram_chat_id, html, buttons, { parse_mode: "HTML" });
  } catch (error) {
    // If Telegram could not read the formatting, send the same message as plain text instead of losing it.
    console.error(`[notify] Telegram refused "${notification.subject}", retrying as plain text: ${error.message}`);
    try {
      await sendTelegramMessage(user.telegram_chat_id, text);
    } catch (retryError) {
      console.error(`[notify] could not send Telegram message ("${notification.subject}"): ${retryError.message}`);
    }
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
      notification: {
        subject: `New message from ${sender.name} about ${quoted(rows[0].title)}`,
        preheader: preview(body),
        emoji: "💬",
        heading: `New message from ${sender.name}`,
        intro: `${sender.name} wrote to you about "${rows[0].title}".`,
        quote: preview(body),
        action: { label: `Reply to ${sender.name}`, link: threadLink(listingId, senderId) },
      },
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
      notification: {
        subject: `You've been outbid on ${quoted(listing.title)}`,
        emoji: "🔔",
        heading: "You've been outbid",
        intro: `Someone bid ${money(amount)}, so you are no longer the highest bidder.`,
        details: [["Item", listing.title], ["Highest bid", money(amount)]],
        action: { label: "Bid again", link: appLink(`/listings/${listingId}`) },
      },
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
        notification: {
          subject: `You won ${quoted(title)} for ${money(amount)}`,
          emoji: "🎉",
          heading: "You won the auction",
          intro: `Your bid was the highest. Message ${seller.name} to arrange a time and place to meet on campus.`,
          details: [["Item", title], ["Winning bid", money(amount)], ["Seller", seller.name]],
          action: { label: `Message ${seller.name}`, link: threadLink(listingId, sellerId) },
        },
      }),
      deliver({
        to: seller,
        notification: {
          subject: `Your auction ${quoted(title)} ended at ${money(amount)}`,
          emoji: "🔨",
          heading: "Your auction has ended",
          intro: `${winner.name} won it. The listing is now reserved for them: message them to arrange the handover.`,
          details: [["Item", title], ["Winning bid", money(amount)], ["Winner", winner.name]],
          action: { label: `Message ${winner.name}`, link: threadLink(listingId, winnerId) },
        },
      }),
    ]);
  });
}

/** When the payment was made, in Phnom Penh time, for a receipt line. */
function paidDate() {
  return new Date().toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh", dateStyle: "medium", timeStyle: "short" });
}

/** An online payment (card or KHQR) went through: tell the seller to hand the item over, and give the buyer a receipt. */
export function notifyPaid({ listing_id: listingId, buyer_id: buyerId, amount }) {
  inBackground(async () => {
    const { rows } = await query("SELECT title, user_id FROM listings WHERE id = $1", [listingId]);
    if (!rows[0]) return;
    const { title, user_id: sellerId } = rows[0];
    const [buyer, seller] = await Promise.all([findUser(buyerId), findUser(sellerId)]);
    if (!buyer || !seller) return;

    const invoiceNo = invoiceNumber(listingId);
    const date = paidDate();
    const total = `${money(amount)} USD`;
    const receipt = { label: "View receipt", link: appLink(`/listings/${listingId}?invoice=${invoiceNo}`) };

    await Promise.all([
      deliver({
        to: seller,
        notification: {
          subject: `${buyer.name} paid ${money(amount)} for ${quoted(title)}`,
          emoji: "💰",
          heading: `${buyer.name} paid for your item`,
          intro: `The listing is now marked as sold. Message ${buyer.name} to arrange the handover on campus.`,
          details: [["Item", title], ["Amount received", total], ["Buyer", buyer.name],
            ["Invoice", invoiceNo, "code"], ["Date", date]],
          action: { label: `Message ${buyer.name}`, link: threadLink(listingId, buyerId) },
          secondAction: receipt,
        },
      }),
      deliver({
        to: buyer,
        notification: {
          subject: `Payment received: ${quoted(title)}`,
          emoji: "✅",
          heading: "Payment confirmed",
          intro: `Your payment went through. Message ${seller.name} to arrange the handover on campus.`,
          details: [["Item", title], ["Total paid", total], ["Seller", seller.name],
            ["Invoice", invoiceNo, "code"], ["Date", date]],
          action: { label: `Message ${seller.name}`, link: threadLink(listingId, sellerId) },
          secondAction: receipt,
        },
      }),
    ]);
  });
}

/**
 * A payment arrived after the item was already sold, or reserved for another buyer whose offer the
 * seller accepted (see markPaid): the buyer must be refunded.
 */
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
        notification: {
          subject: `Refund needed: ${buyer.name} paid ${money(amount)} for ${quoted(title)}`,
          emoji: "⚠️",
          heading: `Please refund ${buyer.name}`,
          intro: `${buyer.name}'s payment arrived after the item was already sold or reserved for another buyer. `
            + `Please send the ${money(amount)} back to ${buyer.name}, and message them to confirm.`,
          details: [["Item", title], ["Refund", `${money(amount)} from you to ${buyer.name}`]],
          action: { label: `Message ${buyer.name}`, link: threadLink(listingId, buyerId) },
          note: `If you sold the item to ${buyer.name} yourself, this was their payment for it: nothing needs refunding.`,
        },
      }),
      deliver({
        to: buyer,
        notification: {
          subject: `Your payment for ${quoted(title)} arrived too late`,
          emoji: "⚠️",
          heading: "Your payment arrived too late",
          intro: `Your payment went through, but the item had already been sold or reserved for another buyer. `
            + `${seller.name} has been asked to refund you. Message them if you have not heard back.`,
          details: [["Item", title], ["Refund due", `${money(amount)} from ${seller.name} to you`]],
          action: { label: `Message ${seller.name}`, link: threadLink(listingId, sellerId) },
          note: `If ${seller.name} gave you the item, this was your payment for it: no refund is due.`,
        },
      }),
    ]);
  });
}

/**
 * The password was changed or reset: tell the owner, in case it was not them (by Telegram too,
 * in case the inbox itself was taken over).
 */
export function notifyPasswordChanged(userId) {
  inBackground(async () => {
    const user = await findUser(userId);
    if (!user) return;
    await deliver({
      to: user,
      notification: {
        subject: "Your UniSwap password was changed",
        emoji: "🔒",
        heading: "Your password was changed",
        intro: "Your UniSwap password was just changed, and devices signed in with the old password have been signed out. "
          + "If this was you, there is nothing more to do. If it was not, reset your password now.",
        action: { label: "Reset my password", link: appLink("/forgot-password") },
        note: "Your Telegram connection and Bakong account stay as they were: check in Settings that they are still yours.",
      },
    });
  });
}

/**
 * The owner lowered the price of an item for sale: tell everyone who saved it. One message per
 * person (nobody sees who else saved it), sent one at a time so a popular listing does not open
 * dozens of mail connections at once.
 */
export function notifyPriceDrop({ listingId, title, oldPrice, newPrice }) {
  inBackground(async () => {
    const { rows: savers } = await query(
      `SELECT u.name, u.email, u.telegram_chat_id
       FROM saved_listings s JOIN users u ON u.id = s.user_id
       WHERE s.listing_id = $1`,
      [listingId],
    );
    for (const saver of savers) {
      await deliver({
        to: saver,
        notification: {
          subject: `Price drop: ${quoted(title)} is now ${money(newPrice)}`,
          emoji: "🏷️",
          heading: "Price drop on an item you saved",
          intro: `The price went down from ${money(oldPrice)} to ${money(newPrice)}.`,
          details: [["Item", title], ["Was", money(oldPrice)], ["Now", money(newPrice)]],
          action: { label: "View the listing", link: appLink(`/listings/${listingId}`) },
          note: "You get this because you saved it. Remove it from your Saved page to stop these alerts.",
        },
      });
    }
  });
}

// Most students one new listing can alert (best matches first), so one post can never email everyone.
const MAX_MATCH_ALERTS = 10;

/**
 * A new item matches students' wanted posts (db/matches.js): tell each student once, about their
 * best-matching post. Called only when a listing is created (routes/listings.js), never on edits.
 */
export function notifyWantedMatches({ id: listingId, title }) {
  inBackground(async () => {
    // Every matching post (no limit), so one student with many matching posts cannot use up the
    // places of other students: the cap below counts students, not posts.
    const posts = await findWantedForItem(listingId, null);
    const alerted = new Set();
    for (const post of posts) {
      if (alerted.size >= MAX_MATCH_ALERTS) break;
      // One message per student, about their best match (the posts come best first).
      if (alerted.has(post.user_id)) continue;
      alerted.add(post.user_id);
      const student = await findUser(post.user_id);
      if (!student) continue;
      // One at a time, so ten alerts do not hit the mail server at once.
      await deliver({
        to: student,
        notification: {
          subject: `Match for your wanted post: ${quoted(title)}`,
          emoji: "🔎",
          heading: "Something you're looking for was just posted",
          intro: "A new listing on UniSwap matches your wanted post.",
          details: [["New listing", title], ["Your wanted post", post.title]],
          action: { label: "See the listing", link: appLink(`/listings/${listingId}`) },
          note: "Found what you need? Mark your wanted post as sold or reserved (or delete it) and these alerts stop.",
        },
      });
    }
  });
}

/**
 * The listing, buyer and seller an offer notification is about (`offer` is a row with listing_id
 * and buyer_id), or null if any of them is gone.
 */
async function findOfferPeople({ listing_id: listingId, buyer_id: buyerId }) {
  const { rows: [listing] } = await query(
    "SELECT title, price, status, listing_type, user_id FROM listings WHERE id = $1", [listingId]);
  if (!listing) return null;
  const [buyer, seller] = await Promise.all([findUser(buyerId), findUser(listing.user_id)]);
  return buyer && seller ? { listing, buyer, seller } : null;
}

/** A buyer made (or changed) an offer: tell the seller. */
export function notifyOfferMade(offer) {
  inBackground(async () => {
    const people = await findOfferPeople(offer);
    if (!people) return;
    const { listing, buyer, seller } = people;
    await deliver({
      to: seller,
      notification: {
        subject: `${buyer.name} offered ${money(offer.amount)} for ${quoted(listing.title)}`,
        emoji: "🤝",
        heading: `${buyer.name} made an offer`,
        intro: "Accept it to reserve the item for them at that price, or decline it.",
        details: [["Item", listing.title], ["Offer", money(offer.amount)], ["Your price", money(listing.price)]],
        action: { label: "Answer the offer", link: appLink(`/listings/${offer.listing_id}`) },
      },
    });
  });
}

/** The seller accepted an offer: the item is now reserved for that buyer at the offer's price. */
export function notifyOfferAccepted(offer) {
  inBackground(async () => {
    const people = await findOfferPeople(offer);
    if (!people) return;
    const { listing, buyer, seller } = people;
    await deliver({
      to: buyer,
      notification: {
        subject: `${seller.name} accepted your offer for ${quoted(listing.title)}`,
        emoji: "🎉",
        heading: "Your offer was accepted",
        intro: `${seller.name} accepted your offer. The item is now reserved for you at that price.`,
        details: [["Item", listing.title], ["Agreed price", money(offer.amount)], ["Seller", seller.name]],
        action: { label: "Open the listing", link: appLink(`/listings/${offer.listing_id}`) },
        note: "Pay online from the listing page, or message them to meet on campus and pay in person.",
      },
    });
  });
}

/**
 * An offer was declined: by the seller (the item is still available), because the item was sold,
 * reserved or paid for another way, or because the seller changed it from a sale to another type,
 * which takes no offers. The listing's status and type at sending time tell which.
 */
export function notifyOfferDeclined(offer) {
  inBackground(async () => {
    const people = await findOfferPeople(offer);
    if (!people) return;
    const { listing, buyer, seller } = people;
    let reason = `${seller.name} declined your offer. The item is still available: you can make a new offer.`;
    if (listing.status !== "active") {
      reason = "Your offer was declined because the item is no longer available.";
    } else if (listing.listing_type !== "sale") {
      reason = `Your offer was declined because ${seller.name} changed it from an item for sale to a kind of listing that takes no offers.`;
    }
    await deliver({
      to: buyer,
      notification: {
        subject: `Your offer for ${quoted(listing.title)} was declined`,
        emoji: "ℹ️",
        heading: "Your offer was declined",
        intro: reason,
        details: [["Item", listing.title], ["Your offer", money(offer.amount)]],
        action: { label: "See the listing", link: appLink(`/listings/${offer.listing_id}`) },
      },
    });
  });
}

/** The seller made an item available again, so the accepted offer that reserved it no longer does. */
export function notifyOfferCancelled(offer) {
  inBackground(async () => {
    const people = await findOfferPeople(offer);
    if (!people) return;
    const { listing, buyer, seller } = people;
    await deliver({
      to: buyer,
      notification: {
        subject: `${quoted(listing.title)} is no longer reserved for you`,
        emoji: "ℹ️",
        heading: "The item is no longer reserved for you",
        intro: `${seller.name} made it available again, so your accepted offer no longer reserves it. `
          + `Message ${seller.name} if you still want it.`,
        details: [["Item", listing.title], ["Your offer", money(offer.amount)]],
        action: { label: `Message ${seller.name}`, link: threadLink(offer.listing_id, listing.user_id) },
      },
    });
  });
}
