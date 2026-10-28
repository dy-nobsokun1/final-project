import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

// These modules load config.js, which requires these. No network or database is used.
process.env.DATABASE_URL ??= "postgres://unused";
process.env.JWT_SECRET ??= "unused";
const { signParams } = await import("../src/services/cloudinary.js");
const {
  createCheckoutSession, isValidWebhookSignature, paidCard, retrieveCheckoutSession, toFormBody,
} = await import("../src/services/stripe.js");
const { amountToPay } = await import("../src/utils/payments.js");
const { sendTelegramDocument } = await import("../src/services/telegram.js");

test("Cloudinary signature matches the example in Cloudinary's documentation", () => {
  const params = { timestamp: 1315060510, public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" };
  assert.equal(signParams(params, "abcd"), "bfd09f95f331f558cbd1320e67aa8d488770583e");
});

test("Stripe form body uses nested field names and URL-encodes values", () => {
  const body = toFormBody({ mode: "payment", line_items: [{ quantity: 1, price_data: { unit_amount: 2500 } }], success_url: "https://x/?a={ID}" });
  assert.equal(
    decodeURIComponent(body),
    "mode=payment&line_items[0][quantity]=1&line_items[0][price_data][unit_amount]=2500&success_url=https://x/?a={ID}",
  );
  assert.match(body, /success_url=https%3A%2F%2Fx%2F%3Fa%3D%7BID%7D/);
});

test("Stripe webhook signature: valid, tampered, wrong secret, and too old", () => {
  const secret = "whsec_test";
  const body = '{"type":"checkout.session.completed"}';
  const now = Date.now();
  const t = Math.floor(now / 1000);
  const sign = (payload, key = secret, time = t) =>
    `t=${time},v1=${createHmac("sha256", key).update(`${time}.${payload}`).digest("hex")}`;

  assert.equal(isValidWebhookSignature(body, sign(body), secret, 300, now), true);
  assert.equal(isValidWebhookSignature(body.replace("completed", "expired"), sign(body), secret, 300, now), false);
  assert.equal(isValidWebhookSignature(body, sign(body, "whsec_other"), secret, 300, now), false);
  assert.equal(isValidWebhookSignature(body, sign(body, secret, t - 600), secret, 300, now), false);
  assert.equal(isValidWebhookSignature(body, "garbage", secret, 300, now), false);
  assert.equal(isValidWebhookSignature(body, undefined, secret, 300, now), false);
});

test("Stripe Checkout gets the demo note by its Pay button, and the return check asks for the card", async () => {
  // A fake fetch records what would be sent to Stripe.
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: "cs_test_1" }));
  };
  try {
    await createCheckoutSession({
      title: "Desk", amountCents: 1500, listingId: "l1", buyerId: "b1", successUrl: "https://a/s", cancelUrl: "https://a/c",
    });
    await retrieveCheckoutSession("cs_test_1");
  } finally {
    globalThis.fetch = realFetch;
  }
  const sent = new URLSearchParams(calls[0].init.body);
  assert.equal(sent.get("custom_text[submit][message]"), "UniSwap demo: no real money is charged.");
  assert.equal(sent.get("line_items[0][price_data][unit_amount]"), "1500");
  assert.equal(calls[1].init.method, "GET");
  assert.equal(calls[1].url, "https://api.stripe.com/v1/checkout/sessions/cs_test_1?expand[]=payment_intent.payment_method");
});

test("the paid card shows its brand's usual name and last 4 digits, and only for a card", () => {
  const paidWith = (card) => paidCard({ payment_intent: { payment_method: { type: "card", card } } });
  assert.deepEqual(paidWith({ brand: "mastercard", last4: "4444" }), { brand: "Mastercard", last4: "4444" });
  assert.deepEqual(paidWith({ brand: "amex", last4: "8431" }), { brand: "American Express", last4: "8431" });
  assert.deepEqual(paidWith({ brand: "unknown", last4: "0005" }), { brand: "card", last4: "0005" });
  assert.equal(paidWith(undefined), null);
  assert.equal(paidCard({ payment_intent: "pi_123" }), null); // not expanded
  assert.equal(paidCard({ payment_intent: null }), null);
});

test("only items for sale and won auctions can be paid, and never by the seller", () => {
  const sale = { user_id: "seller", listing_type: "sale", status: "active", price: "25.00" };
  assert.equal(amountToPay(sale, "buyer"), 25);
  assert.throws(() => amountToPay(sale, "seller"), /your own/);
  assert.throws(() => amountToPay({ ...sale, status: "sold" }, "buyer"), /no longer available/);
  assert.throws(() => amountToPay({ ...sale, price: "0" }, "buyer"), /no price/);

  const auction = { user_id: "seller", listing_type: "auction", status: "reserved", leading_bidder_id: "winner", highest_bid: "40.50" };
  assert.equal(amountToPay(auction, "winner"), 40.5);
  assert.throws(() => amountToPay(auction, "someone-else"), /Only the winner/);
  assert.throws(() => amountToPay({ ...auction, status: "active" }, "winner"), /Only the winner/);

  for (const type of ["trade", "giveaway", "buy_request"]) {
    assert.throws(() => amountToPay({ ...sale, listing_type: type }, "buyer"), /Only items for sale/);
  }
});

test("sendTelegramDocument sends multipart/form-data to Telegram Bot API", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }));
  };
  try {
    const result = await sendTelegramDocument("123456", {
      filename: "invoice.html",
      content: "<h1>Receipt</h1>",
      contentType: "text/html",
      caption: "Your invoice",
      buttons: [[{ text: "Help", url: "https://example.com" }]],
    });
    assert.deepEqual(result, { message_id: 123 });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/sendDocument$/);
    assert.equal(calls[0].init.method, "POST");
    assert.ok(calls[0].init.body instanceof FormData);
    assert.equal(calls[0].init.body.get("chat_id"), "123456");
    assert.equal(calls[0].init.body.get("caption"), "Your invoice");
    assert.equal(calls[0].init.body.get("parse_mode"), "HTML");
    assert.ok(calls[0].init.body.get("reply_markup"));
    assert.ok(calls[0].init.body.get("document"));
  } finally {
    globalThis.fetch = realFetch;
  }
});
