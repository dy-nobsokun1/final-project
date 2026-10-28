import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

// Stripe Checkout in TEST MODE, called through Stripe's web API with fetch (no extra package).
// Test mode moves no real money: pay with card 4242 4242 4242 4242, any future date, any CVC.

const { secretKey } = config.stripe;

// This is a class project: refuse live keys so a real card can never be charged by mistake.
export const isStripeConfigured = Boolean(secretKey?.startsWith("sk_test_"));
if (secretKey && !isStripeConfigured) {
  console.error("[stripe] STRIPE_SECRET_KEY must be a test key (sk_test_...). Payments are disabled.");
}

/** Stripe's API takes form fields with nested names, e.g. line_items[0][price_data][currency]. */
export function toFormBody(fields, prefix = "") {
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && typeof value === "object") parts.push(toFormBody(value, name));
    else parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }
  return parts.filter(Boolean).join("&");
}

async function stripeRequest(method, path, fields) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(fields && { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    body: fields ? toFormBody(fields) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Stripe ${path} failed: ${result.error?.message ?? response.status}`);
  return result;
}

/** Starts a hosted checkout page for one item. Returns { id, url }. */
export function createCheckoutSession({ title, amountCents, listingId, buyerId, customerEmail, successUrl, cancelUrl }) {
  return stripeRequest("POST", "/checkout/sessions", {
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: { currency: "usd", unit_amount: amountCents, product_data: { name: title } },
    }],
    ...(customerEmail && { customer_email: customerEmail }),
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: buyerId,
    metadata: { listing_id: listingId, buyer_id: buyerId },
    // Stripe's shortest allowed lifetime. Meanwhile, other buyers are told someone is paying.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    // Shown beside Stripe's Pay button.
    custom_text: { submit: { message: "UniSwap demo: no real money is charged." } },
  });
}

/** Reads a session, with the card it was paid with (see paidCard). */
export function retrieveCheckoutSession(sessionId) {
  return stripeRequest("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent.payment_method`);
}

// Stripe's card brand codes, written the way people know them. Other brands show as "card".
const CARD_BRANDS = {
  amex: "American Express", discover: "Discover", jcb: "JCB", mastercard: "Mastercard", unionpay: "UnionPay", visa: "Visa",
};

/**
 * The card a session from retrieveCheckoutSession was paid with, as { brand: "Mastercard", last4: "4444" },
 * or null when it was not paid by card. Only shown to the buyer when they come back; never stored.
 */
export function paidCard(session) {
  const card = session?.payment_intent?.payment_method?.card;
  if (!card?.last4) return null;
  return { brand: CARD_BRANDS[card.brand] ?? "card", last4: card.last4 };
}

/**
 * Checks the "Stripe-Signature" header of a webhook: an HMAC-SHA256 of "<timestamp>.<raw body>"
 * made with our webhook secret. Rejects anything older than `toleranceSeconds` (replay protection).
 */
export function isValidWebhookSignature(rawBody, header, secret, toleranceSeconds = 300, now = Date.now()) {
  const parts = Object.fromEntries(String(header ?? "").split(",").map((part) => part.split("=")));
  const timestamp = Number(parts.t);
  if (!parts.t || !parts.v1 || !Number.isFinite(timestamp)) return false;
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  return expected.length === parts.v1.length
    && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
