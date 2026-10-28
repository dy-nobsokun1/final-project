import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi, uniqueEmail } from "./helpers.js";

const api = await startApi();
after(() => api.close());

const verify = (email, code) => api.request("POST", "/api/auth/verify-email", { body: { email, code } });
const login = (credentials) => api.request("POST", "/api/auth/login", { body: credentials });
const WRONG = "That code is not right.";
const EXPIRED = "This code has expired. Sign in to get a new one.";

/** A well-formed code that is not `code`. */
const otherThan = (code) => (code === "000000" ? "111111" : "000000");

/** Registers an unverified account and returns what the tests need. */
async function register(name = "Dara") {
  const credentials = { email: uniqueEmail(), password: "password123" };
  const registered = await api.request("POST", "/api/auth/register", { body: { name, ...credentials } });
  assert.equal(registered.status, 201);
  return { ...credentials, code: await api.loggedCode(credentials.email) };
}

test("sign-up only accepts campus emails and passwords of 8+ characters", async () => {
  const response = await api.request("POST", "/api/auth/register", {
    body: { name: "Dara", email: "dara@gmail.com", password: "short" },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(Object.keys(response.body.details).sort(), ["email", "password"]);
});

test("a new account cannot log in until the emailed code is typed, and the code works once", async () => {
  const { code, ...credentials } = await register();
  assert.match(code, /^\d{6}$/);
  assert.equal((await login(credentials)).status, 403);

  assert.equal((await verify(credentials.email, code)).status, 200);
  assert.equal((await verify(credentials.email, code)).status, 400);

  const signedIn = await login(credentials);
  assert.equal(signedIn.status, 200);
  const me = await api.request("GET", "/api/auth/me", { token: signedIn.body.token });
  assert.equal(me.body.user.email, credentials.email);
  const [row] = await api.sql(
    "SELECT verification_code_hash, verification_code_expires_at, verification_attempts FROM users WHERE email = $1",
    [credentials.email]);
  assert.deepEqual(row, { verification_code_hash: null, verification_code_expires_at: null, verification_attempts: 0 });
});

test("the code is stored only as a hash, and a wrong, odd or unknown answer is refused", async () => {
  const { email, code } = await register();
  const [row] = await api.sql("SELECT verification_code_hash FROM users WHERE email = $1", [email]);
  assert.match(row.verification_code_hash, /^[0-9a-f]{64}$/);

  const wrong = await verify(email, otherThan(code));
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error, WRONG);
  // Not six digits can never be right, and does not use up a try.
  for (const odd of ["12345", "1234567", "abcdef", "", undefined]) assert.equal((await verify(email, odd)).status, 400);
  const [{ verification_attempts: attempts }] = await api.sql("SELECT verification_attempts FROM users WHERE email = $1", [email]);
  assert.equal(attempts, 1);
  // An email nobody registered gets the same plain answer.
  const unknown = await verify(uniqueEmail(), code);
  assert.deepEqual(unknown, wrong);
  assert.equal((await verify(email, code)).status, 200);
});

test("after five wrong tries the right code is refused too", async () => {
  const { email, code, password } = await register();
  const wrong = otherThan(code);
  for (let i = 1; i <= 4; i += 1) assert.equal((await verify(email, wrong)).body.error, WRONG);
  // The fifth wrong try says so straight away, instead of inviting a sixth.
  assert.equal((await verify(email, wrong)).body.error, EXPIRED);
  const late = await verify(email, code);
  assert.equal(late.status, 400);
  assert.equal(late.body.error, EXPIRED);
  assert.equal((await login({ email, password })).status, 403);
});

test("guesses sent at the same moment cannot get more than five tries", async () => {
  const { email, code } = await register();
  const guesses = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(6, "0")).filter((guess) => guess !== code);
  const answers = await Promise.all(guesses.map((guess) => verify(email, guess)));
  assert.equal(answers.filter((answer) => answer.body.error === WRONG).length, 4);
  assert.equal(answers.filter((answer) => answer.body.error === EXPIRED).length, guesses.length - 4);
  const [{ verification_attempts: attempts }] = await api.sql("SELECT verification_attempts FROM users WHERE email = $1", [email]);
  assert.equal(attempts, 5);
  assert.equal((await verify(email, code)).status, 400);
});

test("the fifth try can still be the right one", async () => {
  const { email, code } = await register();
  for (let i = 1; i <= 4; i += 1) assert.equal((await verify(email, otherThan(code))).status, 400);
  assert.equal((await verify(email, code)).status, 200);
});

test("an expired code is refused, and signing in is still locked", async () => {
  const { email, code, password } = await register();
  await api.sql("UPDATE users SET verification_code_expires_at = now() - interval '1 minute' WHERE email = $1", [email]);
  const late = await verify(email, code);
  assert.equal(late.status, 400);
  assert.equal(late.body.error, EXPIRED);
  assert.equal((await login({ email, password })).status, 403);
});

test("a new code from resend works and the old one stops working", async () => {
  const { email, code: first, password } = await register();
  assert.equal((await verify(email, otherThan(first))).status, 400); // a used try, which a new code resets
  const resent = await api.request("POST", "/api/auth/resend-verification", { body: { email, password } });
  // Email is off in tests, so the app answers 502 ("could not send"), but the new code was made and logged.
  assert.equal(resent.status, 502);
  const second = await api.loggedCode(email, 2);
  const [{ verification_attempts: attempts }] = await api.sql("SELECT verification_attempts FROM users WHERE email = $1", [email]);
  assert.equal(attempts, 0);
  if (second !== first) assert.equal((await verify(email, first)).status, 400);
  assert.equal((await verify(email, second)).status, 200);
  // A verified account cannot ask for another code (the 400 comes before any sending).
  const again = await api.request("POST", "/api/auth/resend-verification", { body: { email, password } });
  assert.equal(again.status, 400);
});

test("resend needs the password", async () => {
  const { email } = await register();
  const response = await api.request("POST", "/api/auth/resend-verification", { body: { email, password: "not-the-password" } });
  assert.equal(response.status, 401);
});

test("a wrong password and an unknown email get exactly the same answer", async () => {
  const user = await api.createUser();
  const wrongPassword = await api.request("POST", "/api/auth/login", {
    body: { email: user.email, password: "not-the-password" },
  });
  const unknownEmail = await api.request("POST", "/api/auth/login", {
    body: { email: uniqueEmail(), password: "password123" },
  });
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(unknownEmail, wrongPassword);
});

test("a verified email cannot sign up again, but an unverified sign-up is replaced", async () => {
  const user = await api.createUser();
  const again = await api.request("POST", "/api/auth/register", {
    body: { name: "Impostor", email: user.email, password: "password123" },
  });
  assert.equal(again.status, 409);

  // Someone signs up with your address and never verifies: you can still register,
  // and their code stops working.
  const email = uniqueEmail();
  await api.request("POST", "/api/auth/register", { body: { name: "Stranger", email, password: "password123" } });
  const strangersCode = await api.loggedCode(email);
  const owner = await api.request("POST", "/api/auth/register", { body: { name: "Owner", email, password: "password456" } });
  assert.equal(owner.status, 201);
  const ownersCode = await api.loggedCode(email, 2);
  if (ownersCode !== strangersCode) assert.equal((await verify(email, strangersCode)).status, 400);
  assert.equal((await verify(email, ownersCode)).status, 200);
  // The stranger's password was replaced too: only the owner's works.
  assert.equal((await login({ email, password: "password123" })).status, 401);
  assert.equal((await login({ email, password: "password456" })).status, 200);
});

test("protected routes refuse a missing or forged token", async () => {
  assert.equal((await api.request("GET", "/api/auth/me")).status, 401);
  assert.equal((await api.request("GET", "/api/auth/me", { token: "forged.token.value" })).status, 401);
});

test("a public profile never includes the email address", async () => {
  const user = await api.createUser("Sokunth");
  const profile = await api.request("GET", `/api/users/${user.id}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.name, "Sokunth");
  assert.equal("email" in profile.body.user, false);
});
