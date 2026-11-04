import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

// "Fill in from photo": Gemini's vision model is replaced. The fake answers with `gemini.answer`
// (JSON text) or, while `gemini.status` is not 200, with that error. Every request body is kept in
// `gemini.requests`. Groq must never be called: the photos must not use the assistant's quota.
// All other requests (the tests calling our API) go through as normal.
const realFetch = globalThis.fetch;
const gemini = { answer: "", status: 200, requests: [] };
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith("https://api.groq.com/")) throw new Error("Groq was called for a photo");
  if (!String(url).startsWith("https://generativelanguage.googleapis.com/")) return realFetch(url, options);
  gemini.requests.push({ url: String(url), body: options.body });
  if (gemini.status !== 200) return Response.json({ error: { message: "quota" } }, { status: gemini.status });
  return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: gemini.answer }] } }] });
};

const api = await startApi({ env: { GROQ_API_KEY: "test-key", GEMINI_API_KEY: "test-key" } });
after(() => api.close());

const photo = Buffer.from("fake jpeg bytes");
const send = (token, { type = "image/jpeg", bytes = photo } = {}) =>
  fetch(`${api.baseUrl}/api/assistant/listing-draft`, {
    method: "POST",
    headers: { "Content-Type": type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: bytes,
  }).then(async (response) => ({ status: response.status, body: await response.json() }));

const answerWith = (fields) => {
  gemini.status = 200;
  gemini.answer = JSON.stringify({ title: "Desk lamp", category: "furniture", condition: "good", description: "A lamp.", ...fields });
};

test("is switched on, needs a login, a photo type and a small photo", async () => {
  const student = await api.createUser();
  assert.deepEqual((await api.request("GET", "/api/assistant/listing-draft")).body, { enabled: true });
  gemini.requests.length = 0;
  assert.equal((await send(null)).status, 401);
  assert.equal((await send(student.token, { type: "text/plain" })).status, 415);
  assert.equal((await send(student.token, { bytes: Buffer.alloc(3 * 1024 * 1024) })).status, 413);
  assert.equal(gemini.requests.length, 0);
});

test("sends Gemini only the photo, and returns a checked draft", async () => {
  const seller = await api.createUser("Seller Sokha");
  await api.createListing(seller, { title: "Desk lamp, white", category: "furniture", price: 9 });
  const student = await api.createUser("Student Dara");
  answerWith({ condition: "poor", category: "weapons", price: 500 });

  gemini.requests.length = 0;
  const result = await send(student.token);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(result.body.draft, { title: "Desk lamp", category: "", condition: "", description: "A lamp." });
  assert.equal(result.body.priceHint, null, "no category, so no price hint");

  const [{ url, body }] = gemini.requests;
  assert.match(url, /models\/gemini-3\.1-flash-lite:generateContent$/);
  const request = JSON.parse(body);
  assert.equal(request.contents[0].parts[0].inlineData.data, photo.toString("base64"));
  assert.equal(request.contents[0].parts[0].inlineData.mimeType, "image/jpeg");
  for (const secret of [seller.name, seller.email, student.name, student.email]) {
    assert.ok(!body.includes(secret), `${secret} was sent to Gemini`);
  }
});

test("the price hint comes from similar sale listings, sold ones first", async () => {
  const word = `pangolin${randomUUID().slice(0, 6)}`;
  const [seller, buyer, student] = await Promise.all([api.createUser(), api.createUser(), api.createUser()]);
  answerWith({ title: `Blue ${word} backpack`, category: "other" });

  // Only one match: no hint.
  const first = await api.createListing(seller, { title: `${word} bag`, category: "other", price: 10 });
  assert.equal((await send(student.token)).body.priceHint, null);

  // Not counted: another category, a wanted post, an auction, a giveaway.
  await api.createListing(seller, { title: `${word} lamp`, category: "furniture", price: 99 });
  await api.createListing(buyer, { title: `Looking for ${word}`, category: "other", listingType: "buy_request", price: 200 });
  await api.createListing(seller, {
    title: `${word} auction`, category: "other", listingType: "auction", price: 1,
    auctionEndsAt: new Date(Date.now() + 86400000).toISOString(), minIncrement: 1,
  });
  await api.createListing(seller, { title: `${word} free`, category: "other", listingType: "giveaway", price: 0 });
  const second = await api.createListing(seller, { title: `${word} pack`, category: "other", price: 30 });
  assert.deepEqual((await send(student.token)).body.priceHint, { low: 10, high: 30, count: 2, sold: false });

  // Two sold ones: only those count.
  await api.createListing(seller, { title: `Big ${word}`, category: "other", price: 70 });
  for (const listing of [first, second]) {
    const done = await api.request("PATCH", `/api/listings/${listing.id}`, { token: seller.token, body: { status: "sold" } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
  }
  assert.deepEqual((await send(student.token)).body.priceHint, { low: 10, high: 30, count: 2, sold: true });
});

test("a busy or unreadable model gives a friendly error", async () => {
  const student = await api.createUser();
  gemini.status = 429;
  const busy = await send(student.token);
  assert.equal(busy.status, 503);
  assert.match(busy.body.error, /busy/);

  gemini.status = 200;
  gemini.answer = "It looks like a lamp to me!";
  const unreadable = await send(student.token);
  assert.equal(unreadable.status, 502);
  assert.match(unreadable.body.error, /fill in the form yourself/);
});

test("each student may ask 10 times an hour", async () => {
  const [student, other] = await Promise.all([api.createUser(), api.createUser()]);
  answerWith({});
  for (let i = 0; i < 10; i++) assert.equal((await send(student.token)).status, 200);
  const limited = await send(student.token);
  assert.equal(limited.status, 429);
  assert.match(limited.body.error, /10 times this hour/);
  assert.equal((await send(other.token)).status, 200);
});
