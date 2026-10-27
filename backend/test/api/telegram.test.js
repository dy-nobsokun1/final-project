import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

// Telegram is switched off in tests, so the bot only shows as off here.
const api = await startApi();
after(() => api.close());

// Imported after startApi(), so the bot reads the test database's settings. Each test passes it a
// fake Telegram, so nothing here ever calls the real Bot API or messages a real chat.
const { handleBotUpdate } = await import("../../src/utils/telegramBot.js");

test("anyone can ask whether Telegram alerts are switched on, without signing in", async () => {
  const { status, body } = await api.request("GET", "/api/telegram");
  assert.equal(status, 200);
  // With the bot off there is no chat to link to. Nothing about any user is sent.
  assert.deepEqual(body, { enabled: false, botUrl: null });
});

/** Records what the bot would send. `failPhoto` makes sendPhoto fail, as when Telegram cannot fetch it. */
function fakeTelegram({ failPhoto = false } = {}) {
  const calls = [];
  let messageId = 1000;
  const record = (method) => async (...args) => {
    calls.push({ method, args });
    if (method === "sendPhoto" && failPhoto) throw new Error("Telegram sendPhoto failed: wrong file");
    messageId += 1;
    return { message_id: messageId };
  };
  const methods = ["sendMessage", "sendPhoto", "editMessage", "editButtons", "deleteMessage", "answerButton", "setCommands"];
  return { calls, ...Object.fromEntries(methods.map((method) => [method, record(method)])) };
}

/** The last screen shown ({ method, text, buttons }), whether sent, sent as a photo or edited in place. */
function lastScreen(telegram) {
  const call = telegram.calls.findLast(({ method }) => ["sendMessage", "sendPhoto", "editMessage"].includes(method));
  assert.ok(call, "nothing was shown");
  const [, second, third, fourth] = call.args;
  if (call.method === "sendMessage") return { method: call.method, text: second, buttons: third ?? [] };
  return { method: call.method, text: third, buttons: fourth ?? [] };
}

const buttonTexts = (screen) => screen.buttons.flat().map((button) => button.text);
const buttonData = (screen) => screen.buttons.flat().map((button) => button.callback_data);

// A made-up chat id per test: never a real Telegram chat.
const newChatId = () => `test-chat-${randomUUID()}`;
let updateId = 0;

function sendText(chatId, text, telegram, chatType = "private") {
  updateId += 1;
  return handleBotUpdate({ update_id: updateId, message: { message_id: 1, chat: { id: chatId, type: chatType }, text } }, telegram);
}

/** Taps a button with this data under a bot message (a photo message if `photo`). */
function tap(chatId, data, telegram, { photo = false } = {}) {
  updateId += 1;
  const message = { message_id: 500, chat: { id: chatId, type: "private" }, ...(photo ? { photo: [{}], caption: "" } : { text: "" }) };
  return handleBotUpdate({ update_id: updateId, callback_query: { id: `press-${updateId}`, data, message } }, telegram);
}

/** A student whose account is linked to a new made-up chat, the way the Settings link does it. */
async function linkedUser(name) {
  const user = await api.createUser(name);
  const chatId = newChatId();
  const code = randomUUID().replaceAll("-", "");
  await api.sql("UPDATE users SET telegram_link_code = $2 WHERE id = $1", [user.id, code]);
  await sendText(chatId, `/start ${code}`, fakeTelegram());
  return { ...user, chatId };
}

/** A word no other test's listing contains, so searches find only this test's items. */
const uniqueWord = () => `zq${Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("")}`;

test("an unlinked chat is only told how to connect, also when it taps a button", async () => {
  const telegram = fakeTelegram();
  const chatId = newChatId();
  await sendText(chatId, "lamp", telegram);
  assert.match(lastScreen(telegram).text, /go to Settings and press "Connect Telegram"/);
  assert.deepEqual(lastScreen(telegram).buttons, []);

  await tap(chatId, "saved", telegram);
  assert.equal(lastScreen(telegram).method, "editMessage");
  assert.match(lastScreen(telegram).text, /Connect Telegram/);
  // The button's spinner always stops.
  assert.equal(telegram.calls.at(-1).method, "answerButton");
});

test("linking moves the chat to the new account, so one chat never shows two students", async () => {
  const first = await linkedUser("First Student");
  const second = await api.createUser("Second Student");
  const code = randomUUID().replaceAll("-", "");
  await api.sql("UPDATE users SET telegram_link_code = $2 WHERE id = $1", [second.id, code]);

  const telegram = fakeTelegram();
  await sendText(first.chatId, `/start ${code}`, telegram);
  assert.match(lastScreen(telegram).text, /^Connected as Second Student\./);
  assert.equal(buttonTexts(lastScreen(telegram)).length, 6);
  const rows = await api.sql("SELECT id, telegram_chat_id, telegram_link_code FROM users WHERE id = ANY($1)", [[first.id, second.id]]);
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(byId[first.id].telegram_chat_id, null);
  assert.equal(byId[second.id].telegram_chat_id, first.chatId);
  assert.equal(byId[second.id].telegram_link_code, null);

  // The code works once.
  await sendText(newChatId(), `/start ${code}`, telegram);
  assert.match(lastScreen(telegram).text, /^That link has expired\./);
});

test("typing a word searches, and More shows the next page", async () => {
  const seller = await api.createUser();
  const word = uniqueWord();
  for (let n = 1; n <= 7; n += 1) await api.createListing(seller, { title: `Lamp ${word} ${n}`, price: 10 + n });
  const buyer = await linkedUser();
  const telegram = fakeTelegram();

  await sendText(buyer.chatId, word, telegram);
  const first = lastScreen(telegram);
  assert.match(first.text, new RegExp(`Results for "${word}"`));
  assert.equal(buttonData(first).filter((data) => data.startsWith("item:")).length, 5);
  assert.deepEqual(buttonTexts(first).slice(-2), ["⬅ Menu", "More ▸"]);

  await tap(buyer.chatId, "page:2", telegram);
  const second = lastScreen(telegram);
  assert.equal(second.method, "editMessage");
  assert.equal(buttonData(second).filter((data) => data.startsWith("item:")).length, 2);
  assert.deepEqual(buttonTexts(second).slice(-1), ["⬅ Menu"]);

  // "/search <word>" does the same as typing it.
  await sendText(buyer.chatId, `/search ${word}`, telegram);
  assert.equal(buttonData(lastScreen(telegram)).filter((data) => data.startsWith("item:")).length, 5);
});

test("the item card shows the price and condition, and Save and Unsave change the saved row", async () => {
  const seller = await api.createUser("Card Seller");
  const listing = await api.createListing(seller, { title: `Desk ${uniqueWord()}`, condition: "like_new", price: 25 });
  const buyer = await linkedUser();
  const telegram = fakeTelegram();
  const savedRows = () => api.sql("SELECT 1 FROM saved_listings WHERE user_id = $1 AND listing_id = $2", [buyer.id, listing.id]);

  await tap(buyer.chatId, `item:${listing.id}`, telegram);
  const card = lastScreen(telegram);
  assert.match(card.text, /\$25 · For sale\nCondition: Like new · Textbooks\nSeller: Card Seller/);
  assert.ok(buttonData(card).includes(`save:${listing.id}`));

  await tap(buyer.chatId, `save:${listing.id}`, telegram);
  assert.equal((await savedRows()).length, 1);
  const [answer] = telegram.calls.filter(({ method }) => method === "answerButton").slice(-1);
  assert.equal(answer.args[1], "Saved ❤️");
  const edited = telegram.calls.findLast(({ method }) => method === "editButtons");
  assert.ok(edited.args[2].flat().some((button) => button.callback_data === `unsave:${listing.id}`));

  await tap(buyer.chatId, `unsave:${listing.id}`, telegram);
  assert.equal((await savedRows()).length, 0);

  // A listing that was deleted says so.
  await tap(buyer.chatId, `item:${randomUUID()}`, telegram);
  assert.match(lastScreen(telegram).text, /isn't on UniSwap any more/);
});

test("nobody can save their own listing from Telegram either", async () => {
  const seller = await linkedUser();
  const listing = await api.createListing(seller);
  const telegram = fakeTelegram();

  await tap(seller.chatId, `item:${listing.id}`, telegram);
  assert.ok(!buttonData(lastScreen(telegram)).some((data) => data?.startsWith("save:")));
  assert.match(lastScreen(telegram).text, /This is your listing\./);

  await tap(seller.chatId, `save:${listing.id}`, telegram);
  assert.equal(telegram.calls.at(-1).args[1], "You can't save your own listing.");
  assert.equal((await api.sql("SELECT 1 FROM saved_listings WHERE listing_id = $1", [listing.id])).length, 0);
});

test("a card with a public photo is sent as a photo, and as text if Telegram cannot fetch it", async () => {
  const seller = await api.createUser();
  const listing = await api.createListing(seller);
  // The API only accepts its own uploads; sample listings have public https photos like this one.
  await api.sql("UPDATE listings SET image_urls = $2 WHERE id = $1", [listing.id, ["https://upload.wikimedia.org/test.jpg"]]);
  const buyer = await linkedUser();

  const telegram = fakeTelegram();
  await tap(buyer.chatId, `item:${listing.id}`, telegram);
  const methods = telegram.calls.map(({ method }) => method);
  assert.deepEqual(methods, ["sendPhoto", "deleteMessage", "answerButton"]);
  assert.equal(telegram.calls[0].args[1], "https://upload.wikimedia.org/test.jpg");

  // Back from the photo card sends the menu as text, and removes the photo message.
  await tap(buyer.chatId, "menu", telegram, { photo: true });
  assert.deepEqual(telegram.calls.slice(3).map(({ method }) => method), ["sendMessage", "deleteMessage", "answerButton"]);

  const failing = fakeTelegram({ failPhoto: true });
  await tap(buyer.chatId, `item:${listing.id}`, failing);
  assert.deepEqual(failing.calls.map(({ method }) => method), ["sendPhoto", "sendMessage", "deleteMessage", "answerButton"]);
});

test("Saved, My listings and Inbox show the chat's own account", async () => {
  const seller = await linkedUser("Shop Owner");
  const buyer = await linkedUser("Keen Buyer");
  const lamp = await api.createListing(seller, { title: `Lamp ${uniqueWord()}`, price: 40 });
  const chair = await api.createListing(seller, { title: `Chair ${uniqueWord()}`, price: 15 });
  const sold = await api.createListing(seller, { title: `Sold ${uniqueWord()}` });
  await api.sql("UPDATE listings SET status = 'sold' WHERE id = $1", [sold.id]);
  for (const listing of [lamp, sold]) {
    assert.equal((await api.request("POST", `/api/listings/${listing.id}/save`, { token: buyer.token })).status, 200);
  }
  const offer = await api.request("POST", `/api/listings/${lamp.id}/offers`, { token: buyer.token, body: { amount: 30 } });
  assert.equal(offer.status, 201);
  for (const body of ["Is it still there?", "I can pick it up today."]) {
    const sent = await api.request("POST", "/api/messages", { token: buyer.token, body: { listingId: lamp.id, receiverId: seller.id, body } });
    assert.equal(sent.status, 201);
  }
  const telegram = fakeTelegram();

  await tap(buyer.chatId, "saved", telegram);
  assert.deepEqual(buttonTexts(lastScreen(telegram)), [`${sold.title} · $25 · Sold`, `${lamp.title} · $40 · Available`, "⬅ Menu"]);

  await tap(seller.chatId, "mine", telegram);
  assert.deepEqual(buttonTexts(lastScreen(telegram)), [
    `${chair.title} · $15 · Available · 0 saves`,
    `${lamp.title} · $40 · Available · 1 save · 1 offer waiting`,
    "⬅ Menu",
  ]);

  await sendText(seller.chatId, "/inbox", telegram);
  const inbox = lastScreen(telegram).text;
  assert.match(inbox, /^💬 You have 2 unread messages\./);
  assert.ok(inbox.includes(`Keen Buyer about "${lamp.title}" (2)`));
  // Reading the inbox in Telegram leaves the messages unread on the website.
  const unread = await api.sql("SELECT 1 FROM messages WHERE receiver_id = $1 AND read_at IS NULL", [seller.id]);
  assert.equal(unread.length, 2);

  // Back from an item card returns to the list it came from.
  await tap(buyer.chatId, "saved", telegram);
  await tap(buyer.chatId, `item:${lamp.id}`, telegram);
  assert.ok(buttonTexts(lastScreen(telegram)).includes("⬅ Back to Saved"));
  await tap(buyer.chatId, "back", telegram);
  assert.match(lastScreen(telegram).text, /^Your saved items/);

  // Another student sees none of it, and cannot remove the buyer's saved items with a made-up button.
  const other = await linkedUser();
  await tap(other.chatId, "saved", telegram);
  assert.match(lastScreen(telegram).text, /haven't saved anything/);
  await tap(other.chatId, "mine", telegram);
  assert.match(lastScreen(telegram).text, /no available or reserved listings/);
  await tap(other.chatId, "inbox", telegram);
  assert.equal(lastScreen(telegram).text, "No unread messages.");
  await tap(other.chatId, `unsave:${lamp.id}`, telegram);
  const buyerSaved = await api.sql("SELECT 1 FROM saved_listings WHERE user_id = $1", [buyer.id]);
  assert.equal(buyerSaved.length, 2);
});

test("group chats are ignored, and More after a restart asks to search again", async () => {
  const user = await linkedUser();
  const telegram = fakeTelegram();
  await sendText(user.chatId, "/saved", telegram, "group");
  assert.deepEqual(telegram.calls, []);

  // A chat that has not searched since the API started has no search to continue.
  const fresh = await linkedUser();
  await tap(fresh.chatId, "page:2", telegram);
  assert.match(lastScreen(telegram).text, /That search has expired/);
});
