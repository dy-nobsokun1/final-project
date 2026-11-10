import assert from "node:assert/strict";
import { test } from "node:test";
import { isLinkCodeFresh, LINK_CODE_MINUTES, newLinkCode } from "../src/utils/telegramLinkCode.js";

const MINUTE = 60 * 1000;
const now = Date.UTC(2026, 10, 5, 12, 0);

test("a link code is a Telegram-safe start parameter with its creation time", () => {
  const code = newLinkCode(now);
  assert.match(code, /^[0-9a-f]{32}_[0-9a-z]+$/);
  assert.ok(code.length <= 64);
  assert.notEqual(newLinkCode(now), code); // the random part differs every time
});

test("a code works for 30 minutes, then expires", () => {
  const code = newLinkCode(now);
  assert.equal(LINK_CODE_MINUTES, 30);
  assert.equal(isLinkCodeFresh(code, now), true);
  assert.equal(isLinkCodeFresh(code, now + 30 * MINUTE), true);
  assert.equal(isLinkCodeFresh(code, now + 30 * MINUTE + 1), false);
});

test("old codes without a time part, and other text, count as expired", () => {
  assert.equal(isLinkCodeFresh("0123456789abcdef0123456789abcdef", now), false);
  assert.equal(isLinkCodeFresh("0123456789abcdef0123456789abcdef_", now), false);
  assert.equal(isLinkCodeFresh("hello", now), false);
  assert.equal(isLinkCodeFresh(undefined, now), false);
});
