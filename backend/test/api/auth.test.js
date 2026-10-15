import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi, uniqueEmail } from "./helpers.js";

const api = await startApi();
after(() => api.close());

async function verificationToken(email) {
  const [row] = await api.sql("SELECT verification_token FROM users WHERE email = $1", [email]);
  return row.verification_token;
}

test("sign-up only accepts campus emails and passwords of 8+ characters", async () => {
  const response = await api.request("POST", "/api/auth/register", {
    body: { name: "Dara", email: "dara@gmail.com", password: "short" },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(Object.keys(response.body.details).sort(), ["email", "password"]);
});

test("a new account cannot log in until the emailed link is opened, and the link works once", async () => {
  const credentials = { email: uniqueEmail(), password: "password123" };
  const registered = await api.request("POST", "/api/auth/register", { body: { name: "Dara", ...credentials } });
  assert.equal(registered.status, 201);
  assert.equal((await api.request("POST", "/api/auth/login", { body: credentials })).status, 403);

  const token = await verificationToken(credentials.email);
  assert.equal((await api.request("POST", "/api/auth/verify-email", { body: { token } })).status, 200);
  assert.equal((await api.request("POST", "/api/auth/verify-email", { body: { token } })).status, 400);

  const login = await api.request("POST", "/api/auth/login", { body: credentials });
  assert.equal(login.status, 200);
  const me = await api.request("GET", "/api/auth/me", { token: login.body.token });
  assert.equal(me.body.user.email, credentials.email);
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
  // and their link stops working.
  const email = uniqueEmail();
  await api.request("POST", "/api/auth/register", { body: { name: "Stranger", email, password: "password123" } });
  const strangersToken = await verificationToken(email);
  const owner = await api.request("POST", "/api/auth/register", { body: { name: "Owner", email, password: "password456" } });
  assert.equal(owner.status, 201);
  const stale = await api.request("POST", "/api/auth/verify-email", { body: { token: strangersToken } });
  assert.equal(stale.status, 400);
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
