import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoginLimiter } from "../src/utils/loginLimit.js";

const MINUTE = 60_000;

/** A limiter with a clock the test moves by hand. */
function limiter() {
  const clock = { time: 0 };
  const limit = createLoginLimiter({ limit: 10, windowMs: 15 * MINUTE, now: () => clock.time });
  return { limit, clock };
}

test("10 tries are allowed, the 11th must wait until the first is 15 minutes old", () => {
  const { limit, clock } = limiter();
  for (let i = 0; i < 10; i += 1) {
    assert.equal(limit.begin("a@aupp.edu.kh"), 0);
    clock.time += MINUTE;
  }
  // First try at 0 min, now 10 min: 5 minutes left.
  assert.equal(limit.begin("a@aupp.edu.kh"), 5 * MINUTE);
  // Other accounts are not affected.
  assert.equal(limit.begin("b@aupp.edu.kh"), 0);
  // Blocked tries are not counted: once the first try is 15 minutes old, one more is allowed.
  clock.time = 15 * MINUTE;
  assert.equal(limit.begin("a@aupp.edu.kh"), 0);
  assert.ok(limit.begin("a@aupp.edu.kh") > 0);
});

test("a right password clears the account's count", () => {
  const { limit } = limiter();
  for (let i = 0; i < 9; i += 1) limit.begin("a@aupp.edu.kh");
  limit.succeed("a@aupp.edu.kh");
  for (let i = 0; i < 10; i += 1) assert.equal(limit.begin("a@aupp.edu.kh"), 0);
  assert.ok(limit.begin("a@aupp.edu.kh") > 0);
});

test("old tries are forgotten, so unknown emails do not pile up in memory", () => {
  const { limit, clock } = limiter();
  for (let i = 0; i < 1000; i += 1) limit.begin(`guess${i}@aupp.edu.kh`);
  assert.equal(limit.size(), 1000);
  clock.time += 15 * MINUTE;
  limit.begin("a@aupp.edu.kh");
  assert.equal(limit.size(), 1);
});
