import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, test } from "node:test";
import jwt from "jsonwebtoken";
import { startApi, uniqueEmail } from "./helpers.js";

const api = await startApi();
after(() => api.close());

/** Asks for a reset link and returns the token from the link the app printed (email is off in tests). */
async function requestResetToken(email) {
  const response = await api.request("POST", "/api/auth/forgot-password", { body: { email } });
  assert.equal(response.status, 200);
  return api.loggedLinks("[reset-password]", email).at(-1)?.searchParams.get("token") ?? null;
}

/** A login token issued `secondsAgo` seconds ago: a device that signed in earlier, without sleeping. */
function sessionFrom(userId, secondsAgo) {
  const iat = Math.floor(Date.now() / 1000) - secondsAgo;
  return jwt.sign({ sub: userId, iat }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function reset(token, password) {
  return api.request("POST", "/api/auth/reset-password", { body: { token, password } });
}

function me(token) {
  return api.request("GET", "/api/auth/me", { token });
}

function login(email, password) {
  return api.request("POST", "/api/auth/login", { body: { email, password } });
}

test("forgot-password answers the same for a real account, an unknown email and a quick repeat, and emails the real account once", async () => {
  const notCampus = await api.request("POST", "/api/auth/forgot-password", { body: { email: "someone@gmail.com" } });
  assert.equal(notCampus.status, 400);
  assert.ok(notCampus.body.details.email);

  const user = await api.createUser();
  const unknownEmail = uniqueEmail();
  const answers = [];
  for (const email of [user.email, unknownEmail, user.email]) {
    answers.push(await api.request("POST", "/api/auth/forgot-password", { body: { email } }));
  }
  for (const answer of answers) assert.equal(answer.status, 200);
  assert.deepEqual(answers[1].body, answers[0].body);
  assert.deepEqual(answers[2].body, answers[0].body);

  // The quick repeat sent nothing: one link for the account, none for the unknown address.
  const links = api.loggedLinks("[reset-password]", user.email);
  assert.equal(links.length, 1);
  assert.equal(links[0].pathname, "/reset-password");
  assert.match(links[0].searchParams.get("token"), /^[0-9a-f]{64}$/);
  assert.deepEqual(api.loggedLinks("[reset-password]", unknownEmail), []);
});

test("the reset link sets a new password once, and the database keeps only its hash", async () => {
  const user = await api.createUser();
  const token = await requestResetToken(user.email);
  const [row] = await api.sql("SELECT password_reset_hash FROM users WHERE id = $1", [user.id]);
  assert.equal(row.password_reset_hash, createHash("sha256").update(token).digest("hex"));
  assert.notEqual(row.password_reset_hash, token);

  const done = await reset(token, "a-new-password");
  assert.equal(done.status, 200);
  assert.deepEqual(done.body, { reset: true });
  assert.equal((await login(user.email, "password123")).status, 401);
  assert.equal((await login(user.email, "a-new-password")).status, 200);

  assert.equal((await reset(token, "another-password")).status, 400);
  const [used] = await api.sql(
    "SELECT password_reset_hash, password_reset_expires_at FROM users WHERE id = $1", [user.id]);
  assert.equal(used.password_reset_hash, null);
  assert.equal(used.password_reset_expires_at, null);
});

test("a short password is refused without using up the link, and expired or made-up links are refused", async () => {
  const user = await api.createUser();
  const token = await requestResetToken(user.email);
  const short = await reset(token, "short");
  assert.equal(short.status, 400);
  assert.ok(short.body.details.password);
  assert.equal((await reset(token, "a-new-password")).status, 200);

  // A fresh link (asked for 2 minutes later, so it is not throttled) that has since expired.
  await api.sql("UPDATE users SET password_reset_sent_at = now() - interval '3 minutes' WHERE email = $1", [user.email]);
  const expired = await requestResetToken(user.email);
  assert.ok(expired);
  await api.sql("UPDATE users SET password_reset_expires_at = now() - interval '1 minute' WHERE email = $1", [user.email]);
  assert.equal((await reset(expired, "another-password")).status, 400);

  assert.equal((await reset(randomBytes(32).toString("hex"), "another-password")).status, 400);
  assert.equal((await reset("", "another-password")).status, 400);
});

test("a new link can be sent after 2 minutes, and it replaces the old one", async () => {
  const user = await api.createUser();
  const first = await requestResetToken(user.email);
  await api.sql("UPDATE users SET password_reset_sent_at = now() - interval '3 minutes' WHERE email = $1", [user.email]);
  const second = await requestResetToken(user.email);
  assert.notEqual(second, first);
  assert.equal(api.loggedLinks("[reset-password]", user.email).length, 2);
  assert.equal((await reset(first, "a-new-password")).status, 400);
  assert.equal((await reset(second, "a-new-password")).status, 200);
});

test("once a link is used, a new one can be asked for straight away", async () => {
  const user = await api.createUser();
  // e.g. the new password was mistyped, so the student asks again at once
  assert.equal((await reset(await requestResetToken(user.email), "a-mistyped-password")).status, 200);
  const next = await requestResetToken(user.email);
  assert.equal(api.loggedLinks("[reset-password]", user.email).length, 2);
  assert.equal((await reset(next, "the-password-i-meant")).status, 200);
  assert.equal((await login(user.email, "the-password-i-meant")).status, 200);
});

test("in production a reset link is never printed, even while email is off", async () => {
  const user = await api.createUser();
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const answer = await api.request("POST", "/api/auth/forgot-password", { body: { email: user.email } });
    assert.deepEqual(answer.body, { requested: true });
  } finally {
    if (before === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = before;
  }
  // A link was made (its hash is stored), but it was not printed.
  const [row] = await api.sql("SELECT password_reset_hash FROM users WHERE id = $1", [user.id]);
  assert.notEqual(row.password_reset_hash, null);
  assert.deepEqual(api.loggedLinks("[reset-password]", user.email), []);
});

test("a reset or a password change cancels an unused Telegram connect code", async () => {
  const user = await api.createUser();
  const code = async () =>
    (await api.sql("SELECT telegram_link_code FROM users WHERE id = $1", [user.id]))[0].telegram_link_code;
  // As if a session had pressed "Connect Telegram" and kept the link for later (Telegram is off in tests).
  const keepConnectCode = () =>
    api.sql("UPDATE users SET telegram_link_code = $2 WHERE id = $1", [user.id, randomBytes(16).toString("hex")]);

  await keepConnectCode();
  assert.equal((await reset(await requestResetToken(user.email), "a-new-password")).status, 200);
  assert.equal(await code(), null);

  await keepConnectCode();
  const { token } = (await login(user.email, "a-new-password")).body;
  const changed = await api.request("POST", "/api/auth/change-password", {
    token,
    body: { currentPassword: "a-new-password", newPassword: "another-password" },
  });
  assert.equal(changed.status, 200);
  assert.equal(await code(), null);
});

test("a reset signs out every session started before it", async () => {
  const user = await api.createUser();
  const earlier = sessionFrom(user.id, 60);
  assert.equal((await me(earlier)).status, 200);

  assert.equal((await reset(await requestResetToken(user.email), "a-new-password")).status, 200);
  const signedOut = await me(earlier);
  assert.equal(signedOut.status, 401);
  assert.equal(signedOut.body.error, "Your password was changed. Please log in again.");

  const fresh = await login(user.email, "a-new-password");
  assert.equal((await me(fresh.body.token)).status, 200);
});

test("a token without an issue time is refused", async () => {
  const user = await api.createUser();
  const noIssueTime = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { noTimestamp: true, expiresIn: "7d" });
  assert.equal((await me(noIssueTime)).status, 401);
  assert.equal((await me(sessionFrom(user.id, 0))).status, 200);
});

test("resetting an unverified account's password also verifies it", async () => {
  const email = uniqueEmail();
  const registered = await api.request("POST", "/api/auth/register", {
    body: { name: "Dara", email, password: "password123" },
  });
  assert.equal(registered.status, 201);
  assert.equal((await login(email, "password123")).status, 403);

  const token = await requestResetToken(email);
  assert.notEqual(token, null);
  assert.equal((await reset(token, "a-new-password")).status, 200);
  assert.equal((await login(email, "a-new-password")).status, 200);
  const [row] = await api.sql("SELECT is_verified, verification_token FROM users WHERE email = $1", [email]);
  assert.equal(row.is_verified, true);
  assert.equal(row.verification_token, null);
});

test("changing the password needs the current one, keeps this device signed in and signs out the others", async () => {
  const user = await api.createUser();
  const thisDevice = sessionFrom(user.id, 120);
  const otherDevice = sessionFrom(user.id, 60);
  const pending = await requestResetToken(user.email);
  assert.ok(pending);
  const change = (token, body) => api.request("POST", "/api/auth/change-password", { token, body });

  assert.equal((await change(undefined, { currentPassword: "password123", newPassword: "a-new-password" })).status, 401);
  const wrong = await change(thisDevice, { currentPassword: "not-my-password", newPassword: "a-new-password" });
  assert.equal(wrong.status, 400);
  assert.ok(wrong.body.details.currentPassword);
  const short = await change(thisDevice, { currentPassword: "password123", newPassword: "short" });
  assert.equal(short.status, 400);
  assert.ok(short.body.details.newPassword);

  const changed = await change(thisDevice, { currentPassword: "password123", newPassword: "a-new-password" });
  assert.equal(changed.status, 200);
  assert.equal(typeof changed.body.token, "string");
  assert.equal((await me(changed.body.token)).status, 200);
  assert.equal((await me(otherDevice)).status, 401);
  assert.equal((await me(thisDevice)).status, 401);

  assert.equal((await login(user.email, "password123")).status, 401);
  assert.equal((await login(user.email, "a-new-password")).status, 200);
  // The change also cleared the reset link asked for before it.
  assert.equal((await reset(pending, "another-password")).status, 400);
});
