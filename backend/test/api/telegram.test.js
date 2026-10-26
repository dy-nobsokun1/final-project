import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

// Telegram is switched off in tests, so the bot only shows as off here.
const api = await startApi();
after(() => api.close());

test("anyone can ask whether Telegram alerts are switched on, without signing in", async () => {
  const { status, body } = await api.request("GET", "/api/telegram");
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(body), ["enabled"]);
  assert.equal(typeof body.enabled, "boolean");
});
