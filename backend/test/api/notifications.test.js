import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi, waitFor } from "./helpers.js";

// Telegram is switched on for this file with a public https site address, but its API is replaced:
// every call is recorded, and `telegram.refuseHtml` makes it answer a message with formatting the
// way it does for text it cannot parse. Other requests (the tests calling our API) go through.
const realFetch = globalThis.fetch;
const telegram = { calls: [], refuseHtml: false };
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith("https://api.telegram.org/")) return realFetch(url, options);
  const body = JSON.parse(options.body);
  telegram.calls.push(body);
  if (telegram.refuseHtml && body.parse_mode === "HTML") {
    return Response.json({ ok: false, description: "Bad Request: can't parse entities" });
  }
  return Response.json({ ok: true, result: { message_id: 1 } });
};

const api = await startApi({
  env: { TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_BOT_USERNAME: "test_bot", FRONTEND_ORIGIN: "https://uniswap.example.com" },
});
after(() => api.close());
const { notifyPasswordChanged } = await import("../../src/utils/notify.js");

async function connectedStudent() {
  const user = await api.createUser();
  const chatId = String(Math.floor(Math.random() * 1e12));
  await api.sql("UPDATE users SET telegram_chat_id = $1 WHERE id = $2", [chatId, user.id]);
  return { ...user, chatId };
}
const sentTo = (user) => telegram.calls.filter((call) => String(call.chat_id) === user.chatId);

test("a notification reaches a connected student as formatted Telegram text with a button", async () => {
  const student = await connectedStudent();
  notifyPasswordChanged(student.id);
  await waitFor(() => sentTo(student).length === 1);
  const [call] = sentTo(student);
  assert.equal(call.parse_mode, "HTML");
  assert.ok(call.text.includes("<b>Your password was changed</b>"));
  assert.equal(call.reply_markup.inline_keyboard[0][0].url, "https://uniswap.example.com/forgot-password");
});

test("if Telegram refuses the formatting, the same notification is sent again as plain text", async () => {
  const student = await connectedStudent();
  telegram.refuseHtml = true;
  try {
    notifyPasswordChanged(student.id);
    await waitFor(() => sentTo(student).length === 2);
  } finally {
    telegram.refuseHtml = false;
  }
  const retry = sentTo(student)[1];
  assert.equal(retry.parse_mode, undefined);
  assert.equal(retry.text.includes("<b>"), false);
  assert.ok(retry.text.includes("Reset my password: https://uniswap.example.com/forgot-password"));
});
