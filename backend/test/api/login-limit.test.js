import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi, uniqueEmail } from "./helpers.js";

const api = await startApi();
after(() => api.close());

const login = (email, password) => api.request("POST", "/api/auth/login", { body: { email, password } });
const BLOCKED = "Too many wrong passwords. Try again in 15 minutes.";

test("after 10 wrong passwords even the right one gets 429, on login and resend", async () => {
  const user = await api.createUser();
  for (let i = 0; i < 10; i += 1) assert.equal((await login(user.email, "not-the-password")).status, 401);

  const blocked = await login(user.email, "password123");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, BLOCKED);
  // The same count covers resend-verification, which also checks the password.
  const resend = await api.request("POST", "/api/auth/resend-verification", {
    body: { email: user.email, password: "password123" },
  });
  assert.equal(resend.status, 429);
  // Other accounts can still sign in.
  const other = await api.createUser();
  assert.equal((await login(other.email, "password123")).status, 200);
});

test("the count is per account, ignores case, and a right password clears it", async () => {
  const user = await api.createUser();
  for (let i = 0; i < 9; i += 1) await login(user.email.toUpperCase(), "not-the-password");
  assert.equal((await login(user.email, "password123")).status, 200);
  // Without the reset these 9 would make 18 wrong tries and the next login would be refused.
  for (let i = 0; i < 9; i += 1) assert.equal((await login(user.email, "not-the-password")).status, 401);
  assert.equal((await login(user.email, "password123")).status, 200);
});

test("an unknown email is blocked with exactly the same answer, so the 429 reveals nothing", async () => {
  const user = await api.createUser();
  const unknown = uniqueEmail();
  for (let i = 0; i < 10; i += 1) {
    await login(user.email, "not-the-password");
    await login(unknown, "not-the-password");
  }
  assert.deepEqual(await login(unknown, "password123"), await login(user.email, "password123"));
});

test("an email over 254 characters gets the usual 401 and is never counted", async () => {
  const long = `${"a".repeat(250)}@aupp.edu.kh`;
  for (let i = 0; i < 11; i += 1) {
    const answer = await login(long, "not-the-password");
    assert.equal(answer.status, 401);
    assert.equal(answer.body.error, "Email or password is incorrect.");
  }
});

test("parallel wrong guesses cannot get past the limit", async () => {
  const user = await api.createUser();
  const answers = await Promise.all(Array.from({ length: 15 }, () => login(user.email, "not-the-password")));
  assert.equal(answers.filter((answer) => answer.status === 401).length, 10);
  assert.equal(answers.filter((answer) => answer.status === 429).length, 5);
});
