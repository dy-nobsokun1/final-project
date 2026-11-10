import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";

// config.js requires these. No database is used.
process.env.DATABASE_URL ??= "postgres://unused";
process.env.JWT_SECRET = "unit-test-secret";
const { signToken, verifyToken } = await import("../src/utils/token.js");

test("a token from signToken is accepted", () => {
  const { userId, issuedAt } = verifyToken(signToken("user-1"));
  assert.equal(userId, "user-1");
  assert.ok(Number.isInteger(issuedAt));
});

test("a token signed with another algorithm is refused, even with the right secret", () => {
  const other = jwt.sign({ sub: "user-1" }, "unit-test-secret", { algorithm: "HS512", expiresIn: "7d" });
  assert.throws(() => verifyToken(other), /invalid algorithm/);
});
