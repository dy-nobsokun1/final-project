import { findWantedForItem } from "../db/matches.js";
import { query } from "../db/pool.js";
import { isTelegramConfigured, sendTelegramDocument, sendTelegramMessage } from "../services/telegram.js";
import { siteOrigin } from "../services/tunnel.js";
import { escapeHtml, isEmailConfigured, sendEmail } from "./email.js";

// Notifications by email, and by Telegram for users who connected it in Settings.
// Every function here is "fire and forget": routes call it without `await`, and it never throws,
// so a mail or Telegram problem can never break sending a message, placing a bid or paying.

const PREVIEW_LENGTH = 200;

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

async function findUser(id) {
  const { rows } = await query("SELECT name, email, telegram_chat_id FROM users WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/**
 * Sends one notification to a user (a row from findUser) by email, and by Telegram if they
 * connected it. `lines` are plain text: escaped for the email's HTML, sent as-is to Telegram.
 * `telegram` (optional) can provide custom HTML and inline buttons.
 */
async function deliver({ to, subject, lines, link, linkLabel, telegram }) {
  await Promise.all([
    emailTo(to, { subject, lines, link, linkLabel }),
    telegramTo(to, { subject, lines, link, telegram }),
  ]);
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

async function telegramTo(user, { subject, lines, link, telegram }) {
  if (!isTelegramConfigured || !user.telegram_chat_id) return;
  try {
    if (telegram?.html) {
      await sendTelegramMessage(
        user.telegram_chat_id,
        telegram.html,
        telegram.buttons,
        { parse_mode: "HTML" },
      );
    } else {
      // The first line is the "Hi <name>," greeting, which reads oddly in a chat, so it is dropped.
      await sendTelegramMessage(user.telegram_chat_id, [subject, ...lines.slice(1), link].join("\n\n"));
    }

    if (telegram?.document) {
      try {
        await sendTelegramDocument(user.telegram_chat_id, telegram.document);
      } catch (docError) {
        console.error(`[notify] could not send Telegram document (${telegram.document.filename}): ${docError.message}`);
      }
    }
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

/** Standalone HTML receipt sent directly to Telegram or saved locally. */
function buildInvoiceHtml({ invoiceNo, paidDate, listingTitle, sellerName, buyerName, amount }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UniSwap Invoice ${escapeHtml(invoiceNo)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 32px 16px;
      display: flex;
      justify-content: center;
    }
    .receipt {
      background: #ffffff;
      max-width: 600px;
      width: 100%;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      padding: 32px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 20px;
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      color: #059669;
      letter-spacing: -0.5px;
    }
    .badge {
      display: inline-block;
      background: #d1fae5;
      color: #065f46;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 6px;
    }
    .invoice-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 24px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 12px;
      font-size: 13px;
    }
    .grid-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .grid-value {
      font-weight: 600;
      color: #0f172a;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 24px;
    }
    .table th {
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .table td {
      padding: 16px 0;
      font-size: 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .total-row td {
      border-bottom: none;
      padding-top: 20px;
      font-size: 16px;
      font-weight: 700;
    }
    .total-amount {
      font-size: 22px;
      font-weight: 800;
      color: #059669;
    }
    .actions {
      margin-top: 28px;
      display: flex;
      justify-content: center;
      gap: 12px;
    }
    .btn {
      background: #059669;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);
    }
    .footer {
      margin-top: 28px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .receipt { box-shadow: none; border: none; padding: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div>
        <div class="brand">UniSwap</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Student Marketplace • Campus Trading</div>
      </div>
      <div style="text-align: right;">
        <span class="badge">Verified Payment</span>
        <div class="invoice-id">${escapeHtml(invoiceNo)}</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="grid-label">Buyer</div>
        <div class="grid-value">${escapeHtml(buyerName)}</div>
      </div>
      <div>
        <div class="grid-label">Seller</div>
        <div class="grid-value">${escapeHtml(sellerName)}</div>
      </div>
      <div>
        <div class="grid-label">Payment Date</div>
        <div class="grid-value">${escapeHtml(paidDate)}</div>
      </div>
      <div>
        <div class="grid-label">Payment Method</div>
        <div class="grid-value">Online Payment (KHQR / Card)</div>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${escapeHtml(listingTitle)}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Campus Marketplace Listing</div>
          </td>
          <td style="text-align: right; font-weight: 600; color: #0f172a;">
            ${escapeHtml(money(amount))} USD
          </td>
        </tr>
        <tr class="total-row">
          <td>Total Paid</td>
          <td style="text-align: right;" class="total-amount">
            ${escapeHtml(money(amount))} USD
          </td>
        </tr>
      </tbody>
    </table>

    <div class="actions">
      <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>

    <div class="footer">
      Thank you for supporting sustainable student commerce on campus! • UniSwap
    </div>
  </div>
</body>
</html>`;
}

/** An online payment (card or KHQR) went through: tell the seller to hand the item over, and give the buyer a receipt. */
export function notifyPaid({ listing_id: listingId, buyer_id: buyerId, amount }) {
  inBackground(async () => {
    const { rows } = await query("SELECT title, user_id FROM listings WHERE id = $1", [listingId]);
    if (!rows[0]) return;
    const { title, user_id: sellerId } = rows[0];
    const [buyer, seller] = await Promise.all([findUser(buyerId), findUser(sellerId)]);
    if (!buyer || !seller) return;

    const invoiceNo = `UNI-${String(listingId).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const paidDate = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      dateStyle: "medium",
      timeStyle: "short",
    });
    const chatWithSellerUrl = threadLink(listingId, sellerId);
    const chatWithBuyerUrl = threadLink(listingId, buyerId);
    const listingUrl = appLink(`/listings/${listingId}`);
    const invoiceUrl = appLink(`/listings/${listingId}?invoice=${invoiceNo}`);

    const buyerTelegramHtml = [
      `🧾 <b>PAYMENT CONFIRMED - UniSwap</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<b>Invoice No:</b> <code>${escapeHtml(invoiceNo)}</code>`,
      `<b>Status:</b> ✅ Paid Online`,
      ``,
      `📦 <b>Order Details</b>`,
      `<b>Item:</b> ${escapeHtml(title)}`,
      `<b>Date:</b> ${escapeHtml(paidDate)}`,
      ``,
      `👤 <b>Parties</b>`,
      `<b>Seller:</b> ${escapeHtml(seller.name)}`,
      `<b>Buyer:</b> ${escapeHtml(buyer.name)}`,
      ``,
      `💳 <b>Payment Summary</b>`,
      `<b>Total Paid:</b> <b>${escapeHtml(money(amount))} USD</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<i>Message ${escapeHtml(seller.name)} to arrange the handover on campus.</i>`,
    ].join("\n");

    const sellerTelegramHtml = [
      `🎉 <b>ITEM SOLD - UniSwap</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<b>Invoice No:</b> <code>${escapeHtml(invoiceNo)}</code>`,
      `<b>Status:</b> ✅ Payment Received`,
      ``,
      `📦 <b>Order Details</b>`,
      `<b>Item:</b> ${escapeHtml(title)}`,
      `<b>Date:</b> ${escapeHtml(paidDate)}`,
      `<b>Buyer:</b> ${escapeHtml(buyer.name)}`,
      ``,
      `💳 <b>Payment Summary</b>`,
      `<b>Amount Paid:</b> <b>${escapeHtml(money(amount))} USD</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `<i>This listing is now marked as sold. Message ${escapeHtml(buyer.name)} to arrange the handover on campus.</i>`,
    ].join("\n");

    await Promise.all([
      deliver({
        to: seller,
        subject: `${buyer.name} paid ${money(amount)} for "${title}"`,
        lines: [
          `Hi ${seller.name},`,
          `${buyer.name} paid ${money(amount)} online for "${title}". It is now marked sold.`,
          "Message them to arrange the handover on campus.",
        ],
        link: chatWithBuyerUrl,
        linkLabel: `Message ${buyer.name}`,
        telegram: {
          html: sellerTelegramHtml,
          buttons: [
            [{ text: "📄 View Receipt", url: invoiceUrl }],
            [{ text: "🌐 Check in Website", url: listingUrl }],
            [{ text: `💬 Message ${buyer.name}`, url: chatWithBuyerUrl }],
          ],
        },
      }),
      deliver({
        to: buyer,
        subject: `Payment received: "${title}"`,
        lines: [
          `Hi ${buyer.name},`,
          `Your payment of ${money(amount)} for "${title}" went through.`,
          `Message ${seller.name} to arrange the handover on campus.`,
        ],
        link: chatWithSellerUrl,
        linkLabel: `Message ${seller.name}`,
        telegram: {
          html: buyerTelegramHtml,
          buttons: [
            [{ text: "📥 Download Invoice", url: invoiceUrl }],
            [{ text: "🌐 Check in Website", url: listingUrl }],
            [{ text: `💬 Message ${seller.name}`, url: chatWithSellerUrl }],
          ],
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
        subject: `Refund needed: ${buyer.name} paid ${money(amount)} for "${title}"`,
        lines: [`Hi ${seller.name},`,
          `${buyer.name}'s payment of ${money(amount)} for "${title}" arrived after the item was already sold or reserved for another buyer.`,
          `Please send the ${money(amount)} back to ${buyer.name}, and message them to confirm.`,
          `If you sold the item to ${buyer.name} yourself, this was their payment for it: nothing needs refunding.`],
        link: threadLink(listingId, buyerId),
        linkLabel: `Message ${buyer.name}`,
      }),
      deliver({
        to: buyer,
        subject: `Your payment for "${title}" arrived too late`,
        lines: [`Hi ${buyer.name},`,
          `Your payment of ${money(amount)} for "${title}" went through, but the item had already been sold or reserved for another buyer.`,
          `${seller.name} has been asked to refund you. Message them if you have not heard back.`,
          `If ${seller.name} gave you the item, this was your payment for it: no refund is due.`],
        link: threadLink(listingId, sellerId),
        linkLabel: `Message ${seller.name}`,
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
      subject: "Your UniSwap password was changed",
      lines: [`Hi ${user.name},`,
        "Your UniSwap password was just changed. Devices signed in with the old password have been signed out.",
        "Your Telegram connection and Bakong account stay as they were: check in Settings that they are still yours.",
        "If you did not do this, reset your password now."],
      link: appLink("/forgot-password"),
      linkLabel: "Reset my password",
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
        subject: `Price drop: "${title}" is now ${money(newPrice)}`,
        lines: [`Hi ${saver.name},`,
          `"${title}", which you saved on UniSwap, went down from ${money(oldPrice)} to ${money(newPrice)}.`,
          "You get this because you saved it. Remove it from your Saved page to stop these alerts."],
        link: appLink(`/listings/${listingId}`),
        linkLabel: "View the listing",
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
        subject: `Someone just listed something you're looking for: "${title}"`,
        lines: [`Hi ${student.name},`,
          `"${title}" was just posted on UniSwap. It matches your wanted post "${post.title}".`,
          "Found what you need? Mark your wanted post as sold or reserved (or delete it) and these alerts stop."],
        link: appLink(`/listings/${listingId}`),
        linkLabel: "See the listing",
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
      subject: `${buyer.name} offered ${money(offer.amount)} for "${listing.title}"`,
      lines: [`Hi ${seller.name},`,
        `${buyer.name} offered ${money(offer.amount)} for "${listing.title}" (you asked ${money(listing.price)}).`,
        "Accept it to reserve the item for them at that price, or decline it."],
      link: appLink(`/listings/${offer.listing_id}`),
      linkLabel: "Answer the offer",
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
      subject: `${seller.name} accepted your offer for "${listing.title}"`,
      lines: [`Hi ${buyer.name},`,
        `${seller.name} accepted your offer of ${money(offer.amount)} for "${listing.title}". It is now reserved for you at that price.`,
        "Pay online from the listing page, or message them to meet on campus and pay in person."],
      link: appLink(`/listings/${offer.listing_id}`),
      linkLabel: "Open the listing",
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
    let reason = `${seller.name} declined your offer of ${money(offer.amount)} for "${listing.title}". It is still available: you can make a new offer.`;
    if (listing.status !== "active") {
      reason = `Your offer of ${money(offer.amount)} for "${listing.title}" was declined because the item is no longer available.`;
    } else if (listing.listing_type !== "sale") {
      reason = `Your offer of ${money(offer.amount)} for "${listing.title}" was declined because ${seller.name} changed it from an item for sale to a kind of listing that takes no offers.`;
    }
    await deliver({
      to: buyer,
      subject: `Your offer for "${listing.title}" was declined`,
      lines: [`Hi ${buyer.name},`, reason],
      link: appLink(`/listings/${offer.listing_id}`),
      linkLabel: "See the listing",
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
      subject: `"${listing.title}" is no longer reserved for you`,
      lines: [`Hi ${buyer.name},`,
        `${seller.name} made "${listing.title}" available again, so your accepted offer of ${money(offer.amount)} no longer reserves it.`,
        `Message ${seller.name} if you still want it.`],
      link: threadLink(offer.listing_id, listing.user_id),
      linkLabel: `Message ${seller.name}`,
    });
  });
}
