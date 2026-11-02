import assert from "node:assert/strict";
import { test } from "node:test";

// These modules load config.js, which requires these. No network or database is used.
process.env.DATABASE_URL ??= "postgres://unused";
process.env.JWT_SECRET ??= "unused";
const { renderEmail } = await import("../src/utils/notificationEmail.js");
const { renderTelegram } = await import("../src/utils/notificationTelegram.js");
const { publicSiteUrl } = await import("../src/utils/telegramScreens.js");

const HOSTILE = "<script>alert(1)</script>";
const LINK = "https://uniswap.example.com/messages/abc?x=1&y=\"2\"";

const notification = (fields = {}) => ({
  subject: "New message from Dara about \"Desk lamp\"",
  emoji: "💬",
  heading: `New message from ${HOSTILE}`,
  intro: `${HOSTILE} wrote to you about "${HOSTILE}".`,
  details: [["Item", HOSTILE], ["Invoice", "UNI-3F2A9C10", "code"]],
  quote: `${HOSTILE} & "quoted" <b>text</b>`,
  action: { label: `Reply to ${HOSTILE}`, link: LINK },
  secondAction: { label: "View receipt", link: "https://uniswap.example.com/listings/abc" },
  note: `${HOSTILE} note`,
  ...fields,
});

test("the email escapes names, titles and chat text, and the link inside href", () => {
  const { html } = renderEmail(notification(), HOSTILE);
  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("<b>text</b>"), false);
  assert.ok(html.includes("&#60;script&#62;"));
  assert.ok(html.includes('href="https://uniswap.example.com/messages/abc?x=1&#38;y=&#34;2&#34;"'));
});

test("the email has no images, one button, a hidden preheader, and a text part with the link written out", () => {
  const { html, text } = renderEmail(notification({ preheader: "A short preview" }), "Dara");
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes(notification().emoji), false);
  assert.equal(text.includes(notification().emoji), false);
  assert.equal(html.match(/<a /g).length, 1);
  assert.ok(html.includes("display:none") && html.includes("A short preview"));
  assert.ok(html.includes('width="560"') && html.includes("max-width:560px"));
  assert.ok(text.startsWith("Hi Dara,"));
  assert.ok(text.includes(`Reply to ${HOSTILE}: ${LINK}`));
  assert.equal(/<\/?(?:html|table|a|p)\b/.test(text), false);
});

test("the email says why it was sent, and has no unsubscribe link", () => {
  const { html, text } = renderEmail(notification(), "Dara");
  assert.ok(html.includes("because you have a UniSwap account"));
  assert.ok(text.includes("because you have a UniSwap account"));
  assert.equal(/unsubscribe/i.test(html), false);
});

test("the Telegram message escapes everything typed and uses only the allowed tags", () => {
  const { html } = renderTelegram(notification(), "https://uniswap.example.com");
  assert.equal(html.includes("<script"), false);
  assert.ok(html.includes("&#60;script&#62;"));
  const tags = new Set([...html.matchAll(/<\/?([a-z]+)/g)].map(([, tag]) => tag));
  assert.deepEqual([...tags].sort(), ["b", "blockquote", "code", "i"]);
  assert.ok(html.startsWith("💬 <b>"));
  assert.ok(html.includes("<code>UNI-3F2A9C10</code>"));
  assert.ok(html.includes("<blockquote>"));
});

test("Telegram gets the main button, and a second one only when the event has one", () => {
  const site = publicSiteUrl("https://uniswap.example.com");
  const two = renderTelegram(notification(), site).buttons;
  assert.deepEqual(two.map(([button]) => button.url), [LINK, "https://uniswap.example.com/listings/abc"]);
  const one = renderTelegram(notification({ secondAction: undefined }), site).buttons;
  assert.equal(one.length, 1);
});

test("with a localhost or plain http site there are no buttons, and the link is written in the message", () => {
  for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.1.5:3000"]) {
    const { html, buttons } = renderTelegram(notification(), publicSiteUrl(origin));
    assert.deepEqual(buttons, []);
    assert.ok(html.includes("https://uniswap.example.com/messages/abc"));
  }
});

test("the plain-text retry has no tags, shows typed text as typed, and still has the link", () => {
  for (const site of ["https://uniswap.example.com", null]) {
    const { text } = renderTelegram(notification({ quote: "A & B" }), site);
    assert.equal(/<\/?(?:b|i|code|blockquote)>/.test(text), false);
    assert.ok(text.includes(`wrote to you about "${HOSTILE}"`));
    assert.ok(text.includes(`Reply to ${HOSTILE}: ${LINK}`));
    assert.ok(text.includes("Invoice: UNI-3F2A9C10"));
  }
});
