import { randomUUID } from "node:crypto";
import { Router } from "express";
import { lockListingForPayment, markPaid, PAYMENT_MINUTES } from "../db/payments.js";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { checkBakongReachable, isBakongConfigured, isKhqrPaid } from "../services/bakong.js";
import { HttpError } from "../utils/httpError.js";
import { buildKhqr, khqrPaysAccount, toAsciiName } from "../utils/khqr.js";

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

// POST /api/payments/khqr  { listingId }  (logged in) -> { paymentId, qr, amount, expiresAt }
khqrRouter.post("/", requireAuth, async (req, res) => {
  if (!isBakongConfigured) throw new HttpError(503, "KHQR payment is not set up yet.");
  const listingId = req.body?.listingId; // req.body is undefined when no JSON body was sent
  if (typeof listingId !== "string" || !listingId) throw new HttpError(400, "Say which listing to pay for (listingId).");
  // A QR only makes sense if we can see it being paid. Asked before the transaction below, so no
  // listing stays locked while we wait for Bakong.
  try {
    await checkBakongReachable();
  } catch (error) {
    console.error("[bakong]", error.message);
    throw new HttpError(503, "KHQR payment is unavailable right now because UniSwap cannot reach Bakong. Please try again later.");
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
  // Not paid, and the item went another way meanwhile (the seller marked it sold or traded, or
  // someone else paid): "unavailable" takes the QR off the buyer's screen so they do not pay it.
  const { rows: [listing] } = await query("SELECT status FROM listings WHERE id = $1", [payment.listing_id]);
  if (!listing) throw new HttpError(404, "Payment not found."); // its listing was deleted meanwhile
  if (listing.status === "sold" || listing.status === "traded") return res.json({ status: "unavailable" });
  res.json({ status: payment.is_expired ? "expired" : "pending" });
});
