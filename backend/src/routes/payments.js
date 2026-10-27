import { Router } from "express";
import { config } from "../config.js";
import { confirmOpenKhqrPayments, lockListingForPayment, markPaid } from "../db/payments.js";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { isBakongConfigured } from "../services/bakong.js";
import {
  createCheckoutSession,
  isStripeConfigured,
  isValidWebhookSignature,
  paidCard,
  retrieveCheckoutSession,
} from "../services/stripe.js";
import { siteOrigin } from "../services/tunnel.js";
import { HttpError } from "../utils/httpError.js";
import { checkoutReturnOrigin, checkoutReturnOrigins } from "../utils/payments.js";

// Online card payments with Stripe Checkout (test mode). The buyer is sent to a page hosted by
// Stripe, so card numbers never touch our servers.
export const paymentsRouter = Router();

// GET /api/payments/config  -> which pay buttons to show: card (`enabled`) and KHQR (`khqr`, routes/khqr.js)
paymentsRouter.get("/config", (req, res) => {
  res.json({ enabled: isStripeConfigured, khqr: isBakongConfigured });
});

// POST /api/payments/checkout  { listingId, returnOrigin? }  (logged in) -> { url } of Stripe's payment page
// returnOrigin is the address the buyer is on (the Next server reads it from the request); it is used
// only if it is FRONTEND_ORIGIN, the tunnel's current address or http://localhost:3000, see checkoutReturnOrigins.
paymentsRouter.post("/checkout", requireAuth, async (req, res) => {
  if (!isStripeConfigured) throw new HttpError(503, "Online payment is not set up yet.");
  // An earlier KHQR for this item may have been paid without being confirmed yet: record it first,
  // so nobody pays for the item a second time (see confirmOpenKhqrPayments).
  try {
    await confirmOpenKhqrPayments(req.body?.listingId);
  } catch (error) {
    console.error("[bakong]", error.message);
    throw new HttpError(503, "Cannot check an earlier KHQR payment for this item right now. Please try again later.");
  }

  const url = await withTransaction(async (client) => {
    // Refuses if the item is already paid for, or someone else is paying right now.
    // req.body is undefined when no JSON body was sent; lockListingForPayment then answers 404.
    const { listing, amount } = await lockListingForPayment(client, req.body?.listingId, req.userId);

    const origin = checkoutReturnOrigin(req.body?.returnOrigin, checkoutReturnOrigins(config.frontendOrigin, siteOrigin()), config.frontendOrigin);
    const page = `${origin}/listings/${listing.id}`;
    const session = await createCheckoutSession({
      title: listing.title,
      amountCents: Math.round(amount * 100),
      listingId: listing.id,
      buyerId: req.userId,
      // Stripe replaces {CHECKOUT_SESSION_ID}, so the listing page can confirm the payment.
      successUrl: `${page}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: page,
    });
    await client.query(
      "INSERT INTO payments (listing_id, buyer_id, amount, stripe_session_id) VALUES ($1, $2, $3, $4)",
      [listing.id, req.userId, amount, session.id],
    );
    return session.url;
  });

  res.status(201).json({ url });
});

// POST /api/payments/confirm  { sessionId }  (logged in) -> { status: "paid" | "pending" | "refund_due", card? }
// Called when the buyer comes back from Stripe. We ask Stripe directly instead of trusting the URL.
// A "paid" answer also has `card` ({ brand, last4 }, see paidCard) when Stripe gives it, so the page
// can say "Paid with Mastercard •••• 4444". It is never stored.
paymentsRouter.post("/confirm", requireAuth, async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? "");
  const { rows } = await query("SELECT id, buyer_id, status FROM payments WHERE stripe_session_id = $1", [sessionId]);
  if (!rows[0] || rows[0].buyer_id !== req.userId) throw new HttpError(404, "Payment not found.");
  if (rows[0].status !== "pending") {
    // Already recorded (by the webhook, or an earlier visit). The card is only a nicety: if Stripe
    // does not answer, the buyer is still told the payment went through.
    const card = rows[0].status === "paid" && isStripeConfigured
      ? await retrieveCheckoutSession(sessionId).then(paidCard, () => null)
      : null;
    return res.json({ status: rows[0].status, ...(card && { card }) });
  }

  const session = await retrieveCheckoutSession(sessionId);
  if (session.payment_status !== "paid") return res.json({ status: "pending" });
  // null means another call (e.g. the webhook) recorded it a moment ago: read what it decided.
  const payment = await markPaid(rows[0].id)
    ?? (await query("SELECT status FROM payments WHERE id = $1", [rows[0].id])).rows[0];
  if (!payment) throw new HttpError(404, "Payment not found."); // its listing was deleted meanwhile
  const card = payment.status === "paid" ? paidCard(session) : null;
  res.json({ status: payment.status, ...(card && { card }) });
});

/**
 * POST /api/payments/webhook  (called by Stripe, not by users). Mounted in app.js with the raw
 * body, because the signature is computed over the exact bytes Stripe sent. Covers buyers who
 * close the tab before returning to UniSwap.
 */
export async function stripeWebhook(req, res) {
  const secret = config.stripe.webhookSecret;
  if (!isStripeConfigured || !secret) throw new HttpError(503, "Stripe webhooks are not set up.");
  // Without a JSON body there is no Buffer here; an empty text then fails the signature check (400).
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!isValidWebhookSignature(rawBody, req.get("stripe-signature"), secret)) {
    throw new HttpError(400, "Invalid Stripe signature.");
  }
  const event = JSON.parse(rawBody);
  const session = event.data?.object;
  if (event.type === "checkout.session.completed" && session?.payment_status === "paid") {
    const { rows } = await query("SELECT id FROM payments WHERE stripe_session_id = $1", [session.id]);
    if (rows[0]) await markPaid(rows[0].id);
  }
  res.json({ received: true });
}
