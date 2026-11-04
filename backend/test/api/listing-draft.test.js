import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

// "Fill in from photo": Gemini and Groq are replaced. Each fake answers with `answer` (JSON text) or,
// while its `status` is not 200, with that error, and keeps every request in `requests`. Gemini is the
// main model; Groq is only the fallback when Gemini is busy, at most VISION_FALLBACK_PER_DAY (3 here)
// times, because it shares the assistant's quota. All other requests (the tests calling our API) go
// through as normal.
const realFetch = globalThis.fetch;
const gemini = { answer: "", status: 200, requests: [] };
const groq = { answer: "", status: 200, requests: [] };
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith("https://api.groq.com/")) {
    groq.requests.push(options.body);
    if (groq.status !== 200) return Response.json({ error: { message: "busy" } }, { status: groq.status });
    return Response.json({ choices: [{ message: { role: "assistant", content: groq.answer } }] });
  }
  if (!String(url).startsWith("https://generativelanguage.googleapis.com/")) return realFetch(url, options);
  gemini.requests.push({ url: String(url), body: options.body });
  if (gemini.status !== 200) return Response.json({ error: { message: "high demand" } }, { status: gemini.status });
  return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: gemini.answer }] } }] });
};

const api = await startApi({ env: { GROQ_API_KEY: "test-key", GEMINI_API_KEY: "test-key", VISION_FALLBACK_PER_DAY: "3" } });
after(() => api.close());

const photo = Buffer.from("fake jpeg bytes");
const send = (token, { type = "image/jpeg", bytes = photo } = {}) =>
  fetch(`${api.baseUrl}/api/assistant/listing-draft`, {
    method: "POST",
    headers: { "Content-Type": type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: bytes,
  }).then(async (response) => ({ status: response.status, body: await response.json() }));

const draftJson = (fields) =>
  JSON.stringify({ title: "Desk lamp", category: "furniture", condition: "good", description: "A lamp.", ...fields });
const answerWith = (fields) => {
  Object.assign(gemini, { status: 200, answer: draftJson(fields) });
  Object.assign(groq, { status: 200, answer: draftJson({ title: "Lamp from Groq" }) });
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
  groq.requests.length = 0;
  const result = await send(student.token);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(groq.requests.length, 0, "Groq is only the fallback");
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
  // Two words, so one word in common is enough (closestMatches).
  answerWith({ title: `${word} backpack`, category: "other" });

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

test("the price hint uses only the closest titles, not items sharing one word", async () => {
  // Like a MacBook photo: two real matches, and cheap laptop RAM and an iPad Pro that share one word.
  const id = randomUUID().slice(0, 6);
  const [brand, model] = [`zorbex${id}`, `quillbook${id}`];
  const [seller, student] = await Promise.all([api.createUser(), api.createUser()]);
  answerWith({ title: `${brand} ${model} Pro laptop`, category: "electronics" });

  await api.createListing(seller, { title: `${brand} ${model} 13-inch`, category: "electronics", price: 500 });
  const second = await api.createListing(seller, { title: `Used ${brand} ${model} Pro`, category: "electronics", price: 600 });
  await api.createListing(seller, { title: `DDR4 laptop RAM ${id}`, category: "electronics", price: 12 });
  await api.createListing(seller, { title: `${brand} charger`, category: "electronics", price: 15 });
  // The second one shares 3 words, the first only 2: only the closest group counts, so one item, no hint.
  assert.equal((await send(student.token)).body.priceHint, null);

  // Two items sharing the same, best number of words: their prices only.
  await api.createListing(seller, { title: `${brand} ${model} Pro 2021`, category: "electronics", price: 550 });
  assert.deepEqual((await send(student.token)).body.priceHint, { low: 550, high: 600, count: 2, sold: false });

  // Left with one closest match, weaker ones (2 words, or 1) are not used instead.
  const removed = await api.request("DELETE", `/api/listings/${second.id}`, { token: seller.token });
  assert.equal(removed.status, 204, JSON.stringify(removed.body));
  assert.equal((await send(student.token)).body.priceHint, null);
});

test("a busy Gemini falls back to Groq once, which gets only the photo too", async () => {
  const student = await api.createUser("Student Dara");
  answerWith({});
  gemini.status = 503;
  groq.requests.length = 0;
  const result = await send(student.token);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.draft.title, "Lamp from Groq");
  assert.equal(groq.requests.length, 1);
  const body = groq.requests[0];
  assert.equal(JSON.parse(body).model, "qwen/qwen3.8-27b");
  assert.ok(body.includes(`data:image/jpeg;base64,${photo.toString("base64")}`));
  for (const secret of [student.name, student.email]) assert.ok(!body.includes(secret), `${secret} was sent to Groq`);
});

test("a refused request does not fall back, and a busy fallback says busy", async () => {
  const student = await api.createUser();
  answerWith({});
  gemini.status = 400;
  groq.requests.length = 0;
  const refused = await send(student.token);
  assert.equal(refused.status, 502);
  assert.equal(groq.requests.length, 0);

  gemini.status = 503;
  groq.status = 429;
  const busy = await send(student.token);
  assert.equal(busy.status, 503);
  assert.match(busy.body.error, /busy/);
  assert.equal(groq.requests.length, 1);
});

test("an unreadable answer gives a friendly error", async () => {
  const student = await api.createUser();
  answerWith({});
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

test("Groq takes at most VISION_FALLBACK_PER_DAY photos a day", async () => {
  // The two tests above used 2 of the 3 fallbacks.
  const student = await api.createUser();
  answerWith({});
  gemini.status = 503;
  groq.requests.length = 0;
  assert.equal((await send(student.token)).status, 200);
  const capped = await send(student.token);
  assert.equal(capped.status, 503);
  assert.match(capped.body.error, /busy/);
  assert.equal(groq.requests.length, 1, "the fourth fallback never reached Groq");
});
