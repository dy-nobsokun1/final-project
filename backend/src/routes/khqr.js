import { randomUUID } from "node:crypto";
import { Router } from "express";
import { LISTING_SELECT } from "../db/listings.js";
import { confirmOpenKhqrPayments, lockListingForPayment, markPaid, PAYMENT_MINUTES } from "../db/payments.js";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { checkBakongReachable, isBakongConfigured, isKhqrPaid } from "../services/bakong.js";
import { HttpError } from "../utils/httpError.js";
import { buildKhqr, khqrPaysAccount, toAsciiName } from "../utils/khqr.js";
import { amountToPay } from "../utils/payments.js";
import { isUuid } from "../utils/validation.js";

// KHQR payments: the buyer scans a QR with any Cambodian banking app, and the money goes straight
// to the seller's own Bakong account. UniSwap never holds it: we only ask Bakong whether the QR
// was paid, then mark the item sold. Unlike Stripe test mode, this moves REAL money.
export const khqrRouter = Router();

const expiresAt = (payment) => new Date(payment.created_at.getTime() + PAYMENT_MINUTES * 60_000);

const toKhqrPayment = (payment) => ({
  paymentId: payment.id,
  qr: payment.khqr,
  amount: Number(payment.amount),
  expiresAt: expiresAt(payment),
});

/**
 * What `buyerId` would be asked to pay for `listing` (a LISTING_SELECT row) if they started paying
 * now, or null if they cannot pay for it online now. A null leaves an open QR as it is: e.g. the
 * owner marked a sale item reserved by hand, which does not cancel a payment already in progress
 * (README "Known limitations").
 */
function amountOwedNow(listing, buyerId) {
  try {
    return amountToPay(listing, buyerId);
  } catch (error) {
    if (error instanceof HttpError) return null;
    throw error;
  }
}

// POST /api/payments/khqr  { listingId }  (logged in) -> { paymentId, qr, amount, expiresAt }
khqrRouter.post("/", requireAuth, async (req, res) => {
  if (!isBakongConfigured) throw new HttpError(503, "KHQR payment is not set up yet.");
  const listingId = req.body?.listingId; // req.body is undefined when no JSON body was sent
  if (typeof listingId !== "string" || !listingId) throw new HttpError(400, "Say which listing to pay for (listingId).");
  if (!isUuid(listingId)) throw new HttpError(404, "Listing not found."); // before asking Bakong anything

  // Asked before the transaction below, so no listing stays locked while we wait for Bakong:
  // - an earlier QR for this item may have been paid without being confirmed yet (e.g. Bakong was
  //   down). Recording it first means nobody can pay for the item a second time.
  // - a QR only makes sense if we can see it being paid, so Bakong must be answering right now.
  let recorded;
  try {
    recorded = await confirmOpenKhqrPayments(listingId);
    await checkBakongReachable();
  } catch (error) {
    console.error("[bakong]", error.message);
    throw new HttpError(503, "KHQR payment is unavailable right now because UniSwap cannot reach Bakong. Please try again later.");
  }
  if (recorded.some((payment) => payment.buyer_id === req.userId && payment.status === "paid")) {
    throw new HttpError(409, "Your earlier KHQR payment for this item went through, so it is yours. Refresh the page to see it.");
  }

  const payment = await withTransaction(async (client) => {
    // Refuses if the item is already paid for, or someone else is paying right now.
    const { listing, amount } = await lockListingForPayment(client, listingId, req.userId);

    const { rows: [seller] } = await client.query(
      "SELECT name, bakong_account_id FROM users WHERE id = $1", [listing.user_id]);
    if (!seller.bakong_account_id) {
      throw new HttpError(400, "The seller has not added a Bakong account, so this item cannot be paid by KHQR.");
    }

    // Asking again (e.g. after a page refresh) shows the same QR, so the buyer cannot pay twice,
    // as long as it still pays the seller's current Bakong account (they may have changed it since).
    const { rows: [open] } = await client.query(
      `SELECT * FROM payments
       WHERE listing_id = $1 AND buyer_id = $2 AND method = 'khqr' AND status = 'pending' AND amount = $3
         AND created_at > now() - make_interval(mins => $4)
       ORDER BY created_at DESC LIMIT 1`,
      [listing.id, req.userId, amount, PAYMENT_MINUTES],
    );
    if (open && khqrPaysAccount(open.khqr, seller.bakong_account_id)) return open;

    const id = randomUUID();
    // The database's clock, not this server's: every payment window is measured with its now().
    const { rows: [{ now: createdAt }] } = await client.query("SELECT now()");
    const khqr = buildKhqr({
      accountId: seller.bakong_account_id,
      receiverName: toAsciiName(seller.name),
      amount,
      billNumber: `UNISWAP-${id.slice(0, 8)}`, // shown in both people's banking apps
      createdAt,
      expiresAt: new Date(createdAt.getTime() + PAYMENT_MINUTES * 60_000),
    });
    const { rows } = await client.query(
      `INSERT INTO payments (id, listing_id, buyer_id, amount, method, khqr, created_at)
       VALUES ($1, $2, $3, $4, 'khqr', $5, $6) RETURNING *`,
      [id, listing.id, req.userId, amount, khqr, createdAt],
    );
    return rows[0];
  });

  res.status(201).json(toKhqrPayment(payment));
});

// GET /api/payments/khqr/:id  (logged in, the buyer only)
//   -> { status: "paid" | "pending" | "expired" | "refund_due" | "unavailable" }
// The QR screen asks every few seconds. Each time, we ask Bakong: the browser is never trusted.
khqrRouter.get("/:id", requireAuth, async (req, res) => {
  if (!isBakongConfigured) throw new HttpError(503, "KHQR payment is not set up yet.");
  const { rows } = await query(
    `SELECT *, created_at + make_interval(mins => $2) <= now() AS is_expired
     FROM payments WHERE id = $1 AND method = 'khqr'`,
    [req.params.id, PAYMENT_MINUTES],
  );
  const payment = rows[0];
  if (!payment || payment.buyer_id !== req.userId) throw new HttpError(404, "Payment not found.");
  if (payment.status !== "pending") return res.json({ status: payment.status });

  let paid;
  try {
    paid = await isKhqrPaid(payment.khqr);
  } catch (error) {
    console.error("[bakong]", error.message);
    throw new HttpError(502, "Could not reach Bakong to check the payment. Trying again shortly.");
  }
  if (paid) {
    const marked = await markPaid(payment.id)
      ?? (await query("SELECT status FROM payments WHERE id = $1", [payment.id])).rows[0];
    if (!marked) throw new HttpError(404, "Payment not found."); // its listing was deleted meanwhile
    return res.json({ status: marked.status });
  }
  // Not paid, as far as Bakong knew a moment ago. Read everything again in one go: this same
  // payment may have been recorded meanwhile (by the background check, or a second tab). The listing
  // comes as LISTING_SELECT reads it, so amountToPay can work out what this buyer would pay now.
  const { rows: [latest] } = await query(
    `SELECT p.status AS payment_status, listing.*, seller.bakong_account_id
     FROM payments p
     CROSS JOIN LATERAL (${LISTING_SELECT} WHERE l.id = p.listing_id) listing
     JOIN users seller ON seller.id = listing.user_id
     WHERE p.id = $1`,
    [payment.id],
  );
  if (!latest) throw new HttpError(404, "Payment not found."); // its listing was deleted meanwhile
  if (latest.payment_status !== "pending") return res.json({ status: latest.payment_status });
  // "unavailable" takes the QR off the buyer's screen so they do not pay it: the item went another
  // way (sold or traded, or reserved for another buyer whose offer the seller accepted), the seller
  // changed or removed the Bakong account this QR pays, or this buyer would now pay a different
  // amount (their offer was accepted, the price changed, or the seller made the item available
  // again after accepting their offer).
  const isGone = latest.status === "sold" || latest.status === "traded"
    || (latest.reserved_for !== null && latest.reserved_for !== payment.buyer_id);
  const paysCurrentAccount = Boolean(latest.bakong_account_id) && khqrPaysAccount(payment.khqr, latest.bakong_account_id);
  const owed = amountOwedNow(latest, payment.buyer_id);
  const isRepriced = owed !== null && owed !== Number(payment.amount);
  if (isGone || !paysCurrentAccount || isRepriced) return res.json({ status: "unavailable" });
  res.json({ status: payment.is_expired ? "expired" : "pending" });
});
