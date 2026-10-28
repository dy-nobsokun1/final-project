import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  inboxScreen, itemScreen, menuScreen, myListingsScreen, priceText, publicSiteUrl, resultsScreen, savedScreen, shorten,
} from "../src/utils/telegramScreens.js";

// Rows shaped like LISTING_SELECT's (db/listings.js): prices arrive as PostgreSQL's "25.00" strings.
const row = (fields = {}) => ({
  id: randomUUID(), title: "Desk lamp", listing_type: "sale", price: "12.00", highest_bid: null, auction_ended: false,
  condition: "good", category: "furniture", status: "active", seller_name: "Dara", description: "Warm light.",
  image_urls: [], save_count: 0, waiting_offers: 0, ...fields,
});

const allButtons = (screen) => screen.buttons.flat();
const labels = (screen) => allButtons(screen).map((button) => button.text);

test("the menu has its six buttons, two to a row", () => {
  const { buttons } = menuScreen();
  assert.deepEqual(buttons.map((buttonRow) => buttonRow.map((button) => button.callback_data)),
    [["search", "newest"], ["saved", "mine"], ["inbox", "help"]]);
  assert.deepEqual(labels(menuScreen()), ["🔎 Search", "🆕 Newest", "❤️ Saved", "📦 My listings", "💬 Inbox", "❓ Help"]);
});

test("every button's data fits Telegram's 64 bytes, with real listing ids", () => {
  const rows = Array.from({ length: 5 }, () => row());
  const screens = [
    menuScreen(),
    resultsScreen("lamp", 19, { listings: rows, hasMore: true }),
    itemScreen(rows[0], { isSaved: false, isOwn: false, backTo: "search", siteUrl: null }),
    itemScreen(rows[0], { isSaved: true, isOwn: false, backTo: "saved", siteUrl: null }),
    savedScreen(rows),
    myListingsScreen(rows),
  ];
  for (const button of screens.flatMap(allButtons)) {
    if (button.callback_data) assert.ok(Buffer.byteLength(button.callback_data) <= 64, button.callback_data);
  }
});

test("prices read like the website's: Free, Budget, the current bid, Trade", () => {
  assert.equal(priceText(row()), "$12");
  assert.equal(priceText(row({ price: "12.50" })), "$12.50");
  assert.equal(priceText(row({ listing_type: "giveaway", price: "0.00" })), "Free");
  assert.equal(priceText(row({ listing_type: "buy_request", price: "45.00" })), "Budget: up to $45");
  assert.equal(priceText(row({ listing_type: "buy_request", price: "0.00" })), "Budget: any");
  assert.equal(priceText(row({ listing_type: "auction", price: "20.00", highest_bid: "30.00" })), "$30");
  assert.equal(priceText(row({ listing_type: "auction", price: "20.00" })), "$20");
  assert.equal(priceText(row({ listing_type: "trade", price: "0.00" })), "Trade");
  assert.equal(priceText(row({ listing_type: "trade", price: "5.00" })), "$5");
});

test("search results: one button per item, then More only when there are more", () => {
  const rows = [row({ title: "Desk lamp" }), row({ title: "Floor lamp", price: "20.00" })];
  const withMore = resultsScreen("lamp", 1, { listings: rows, hasMore: true });
  assert.deepEqual(labels(withMore), ["Desk lamp · $12", "Floor lamp · $20", "⬅ Menu", "More ▸"]);
  assert.equal(allButtons(withMore)[0].callback_data, `item:${rows[0].id}`);
  assert.equal(allButtons(withMore).at(-1).callback_data, "page:2");
  assert.deepEqual(labels(resultsScreen("lamp", 2, { listings: rows, hasMore: false })).slice(-1), ["⬅ Menu"]);
  assert.match(resultsScreen("zzz", 1, { listings: [], hasMore: false }).text, /Nothing matches "zzz"/);
});

test("the item card: price, type, condition, seller, a short description, and only public photos", () => {
  const listing = row({ description: "x".repeat(500), image_urls: ["https://upload.wikimedia.org/lamp.jpg"] });
  const card = itemScreen(listing, { isSaved: false, isOwn: false, backTo: "search", siteUrl: null });
  assert.match(card.text, /^Desk lamp\n\$12 · For sale\nCondition: Good · Furniture\nSeller: Dara\n/);
  assert.ok(card.text.length < 300);
  assert.equal(card.photoUrl, "https://upload.wikimedia.org/lamp.jpg");
  assert.deepEqual(labels(card), ["❤️ Save", "⬅ Back to results", "⬅ Menu"]);

  // A photo on this computer's disk cannot be fetched by Telegram, so that card is text only.
  const local = itemScreen(row({ image_urls: ["http://localhost:4000/uploads/a.jpg"] }), { isSaved: true, isOwn: false, backTo: null, siteUrl: null });
  assert.equal(local.photoUrl, undefined);
  assert.deepEqual(labels(local), ["💔 Unsave", "⬅ Menu"]);
});

test("your own listing has no Save button, and the site link shows only on a public site", () => {
  const listing = row({ listing_type: "buy_request", status: "reserved" });
  const card = itemScreen(listing, { isSaved: false, isOwn: true, backTo: "mine", siteUrl: "https://uniswap.example" });
  assert.match(card.text, /Posted by: Dara\nStatus: Reserved\nThis is your listing\./);
  assert.deepEqual(labels(card), ["Open on UniSwap", "⬅ Back to My listings", "⬅ Menu"]);
  assert.equal(allButtons(card)[0].url, `https://uniswap.example/listings/${listing.id}`);
});

test("Saved and My listings label each item with its status, saves and waiting offers", () => {
  assert.deepEqual(labels(savedScreen([row({ status: "sold" })])), ["Desk lamp · $12 · Sold", "⬅ Menu"]);
  const mine = myListingsScreen([row({ save_count: 1 }), row({ save_count: 2, waiting_offers: 1 })]);
  assert.deepEqual(labels(mine), [
    "Desk lamp · $12 · Available · 1 save",
    "Desk lamp · $12 · Available · 2 saves · 1 offer waiting",
    "⬅ Menu",
  ]);
});

test("the inbox counts unread messages per conversation", () => {
  const screen = inboxScreen([
    { partner_name: "Dara", listing_title: "Desk lamp", unread_count: 2 },
    { partner_name: "Sokunth", listing_title: "Calculus book", unread_count: 1 },
  ], null);
  assert.match(screen.text, /^💬 You have 3 unread messages\.\n\nDara about "Desk lamp" \(2\)\nSokunth about "Calculus book" \(1\)/);
  assert.deepEqual(labels(screen), ["⬅ Menu"]);
  assert.deepEqual(labels(inboxScreen([], "https://uniswap.example")), ["Open inbox", "⬅ Menu"]);
  assert.equal(inboxScreen([], null).text, "No unread messages.");
});

test("link buttons only point at a public https site", () => {
  assert.equal(publicSiteUrl("https://uniswap.example"), "https://uniswap.example");
  assert.equal(publicSiteUrl("http://localhost:3000"), null);
  assert.equal(publicSiteUrl("https://localhost:3000"), null);
  assert.equal(publicSiteUrl("http://uniswap.example"), null);
  assert.equal(publicSiteUrl("not a url"), null);
});

test("shortening never cuts an emoji in half", () => {
  assert.equal(shorten("short", 10), "short");
  assert.equal(shorten("abcdefghij", 5), "abcd…");
  assert.equal(shorten("😀😀😀😀😀😀", 4), "😀😀😀…");
});
