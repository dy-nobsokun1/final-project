// Shared setup for the API tests in this folder (run them with: npm run test:api).
// Each test file starts the real Express app on a free port and sends it real HTTP requests, so
// routes, SQL and database rules are tested together. They use a SEPARATE database
// (TEST_DATABASE_URL), because reset-db.js wipes it before every run.
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";

// Switched off in tests, so a test run never sends email or Telegram messages, or calls Stripe, Bakong or Gemini.
const OUTSIDE_SERVICES = [
  "SMTP_HOST", "SMTP_USER", "SMTP_PASS",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "BAKONG_TOKEN",
  "TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME",
  "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
  "GEMINI_API_KEY",
];

function sameDatabase(a, b) {
  const [x, y] = [new URL(a), new URL(b)];
  return x.host === y.host && x.pathname === y.pathname;
}

/** Points the app at the test database. Must run before anything imports src/config.js. */
export function useTestDatabase() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("Set TEST_DATABASE_URL in backend/.env first (see .env.example).");
  // The tests wipe their database, so never let them run against the real one.
  if (process.env.DATABASE_URL && sameDatabase(testUrl, process.env.DATABASE_URL)) {
    throw new Error("TEST_DATABASE_URL must be a separate database, not the one in DATABASE_URL.");
  }
  process.env.DATABASE_URL = testUrl;
  process.env.JWT_SECRET ??= "test-secret";
  for (const name of OUTSIDE_SERVICES) delete process.env[name];
}

/** A fresh campus email, so tests never collide with each other's accounts. */
export function uniqueEmail() {
  return `student-${randomUUID().slice(0, 8)}@test.edu.kh`;
}

// Lines hidden by hideSkippedEmailLogs, oldest first. Tests read from here what the app would have emailed.
const hiddenLogLines = [];

// With email switched off, the app logs every email it skips ("[notify] ...", "[verify-email] ...",
// "[reset-password] ..."). That is expected here, so those lines are not printed but kept in
// hiddenLogLines. Everything else, like server errors, still prints.
function hideSkippedEmailLogs() {
  for (const method of ["log", "error"]) {
    const print = console[method];
    console[method] = (...args) => {
      const line = String(args[0]);
      if (/^\[(notify|verify-email|reset-password)\]/.test(line)) hiddenLogLines.push(line);
      else print(...args);
    };
  }
}

/**
 * Waits until check() returns something truthy, for work the app does in the background
 * (notifications). Fails after `ms`.
 */
export async function waitFor(check, ms = 2000) {
  const deadline = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for background work.");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Starts the app on a free port and returns what the tests need: request() for HTTP calls,
 * baseUrl, for requests request() cannot make, like raw image uploads,
 * createUser() and createListing() for test data, sql() to set up cases the API does not allow
 * (like an auction that already ended), loggedLinks() to open a link the app would have emailed,
 * skippedEmails() to see which notifications it would have emailed (wait for them with waitFor,
 * since they are sent in the background), and close() to stop everything afterwards.
 * Each test file runs in its own process, but the other tests in the same file add log lines too,
 * so always filter them by a unique title or email.
 * `env` switches a service back on for one test file, e.g. { BAKONG_TOKEN: "test" } with a fake fetch.
 */
export async function startApi({ env = {} } = {}) {
  useTestDatabase();
  Object.assign(process.env, env);
  hideSkippedEmailLogs();
  const { app } = await import("../../src/app.js");
  const { pool } = await import("../../src/db/pool.js");
  const server = app.listen(0);
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${baseUrl}${path}`, { method, headers, body: JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function sql(text, params = []) {
    return (await pool.query(text, params)).rows;
  }

  /** Registers, verifies and logs in a new student, like a real person would. */
  async function createUser(name = "Test Student") {
    const email = uniqueEmail();
    const password = "password123";
    assert.equal((await request("POST", "/api/auth/register", { body: { name, email, password } })).status, 201);
    // The real link arrives by email; the tests read its token from the database instead.
    const [{ id, verification_token: token }] = await sql(
      "SELECT id, verification_token FROM users WHERE email = $1", [email]);
    assert.equal((await request("POST", "/api/auth/verify-email", { body: { token } })).status, 200);
    const login = await request("POST", "/api/auth/login", { body: { email, password } });
    assert.equal(login.status, 200);
    return { id, name, email, token: login.body.token };
  }

  /** Posts a listing as `owner`: by default a $25 textbook for sale. */
  async function createListing(owner, fields = {}) {
    const response = await request("POST", "/api/listings", {
      token: owner.token,
      body: { title: "Test listing", category: "textbooks", condition: "good", price: 25, ...fields },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.listing;
  }

  /** The links the app printed for `email` under `prefix` (e.g. "[reset-password]"), oldest first, as URL objects. */
  function loggedLinks(prefix, email) {
    return hiddenLogLines
      .filter((line) => line.startsWith(`${prefix} ${email}: `))
      .map((line) => new URL(line.slice(line.indexOf(": ") + 2)));
  }

  /**
   * What notify.js would have emailed so far in this test file, as its log lines:
   * [notify] email not configured, skipped "<subject>" to <email>
   */
  function skippedEmails() {
    return hiddenLogLines.filter((line) => line.startsWith("[notify] email not configured, skipped "));
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  return { baseUrl, request, sql, createUser, createListing, loggedLinks, skippedEmails, close };
}
