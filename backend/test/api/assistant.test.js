import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

// The assistant is switched on for this file, but Gemini itself is replaced. The fake searches for
// the student's last message, then replies showing the first listing it found. While `gemini.limit`
// is "minute" or "day", it answers 429 for that free-tier limit. Every request body is kept in `gemini.requests`.
// All other requests (the tests calling our API) go through as normal.
const realFetch = globalThis.fetch;
const gemini = { limit: null, requests: [] };
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith("https://generativelanguage.googleapis.com/")) return realFetch(url, options);
  if (gemini.limit) {
    const message = `Quota exceeded: Generate content requests per ${gemini.limit} limit exceeded on Free Tier.`;
    return Response.json({ error: { code: 429, message } }, { status: 429 });
  }
  const body = JSON.parse(options.body);
  gemini.requests.push(body);
  const last = body.contents.at(-1).parts[0];
  const functionCall = last.functionResponse
    ? { name: "reply", args: { text: "Found one.", listingIds: last.functionResponse.response.listings.map((l) => l.id).slice(0, 1) } }
    : { name: "search_listings", args: { query: last.text } };
  return Response.json({ candidates: [{ content: { role: "model", parts: [{ functionCall }] } }] });
};

const api = await startApi({ env: { GEMINI_API_KEY: "test-key" } });
after(() => api.close());

const ask = (user, text) => api.request("POST", "/api/assistant", {
  token: user?.token,
  body: { messages: [{ role: "user", text }] },
});

test("the assistant is switched on, needs a login, and checks the conversation", async () => {
  const student = await api.createUser();
  assert.deepEqual((await api.request("GET", "/api/assistant/config")).body, { enabled: true });
  assert.equal((await ask(null, "a lamp")).status, 401);

  const bad = await api.request("POST", "/api/assistant", { token: student.token, body: { messages: [] } });
  assert.equal(bad.status, 400);
});

test("finds a real listing, leaves wanted posts out, and sends Gemini no seller details", async () => {
  const word = `zebralamp${randomUUID().slice(0, 6)}`;
  const seller = await api.createUser("Seller Sokha");
  const [student, wanter] = await Promise.all([api.createUser(), api.createUser()]);
  await api.createListing(wanter, { title: `Looking for ${word}`, listingType: "buy_request", price: 0 });
  const item = await api.createListing(seller, { title: `${word} desk lamp`, category: "furniture", price: 8 });

  gemini.requests.length = 0;
  const response = await ask(student, word);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.reply, "Found one.");
  assert.deepEqual(response.body.listings.map((l) => l.id), [item.id]);
  assert.equal(response.body.listings[0].seller.name, "Seller Sokha"); // the card gets the full listing
  assert.equal(response.body.wantedDraft, null);

  const sentToGemini = JSON.stringify(gemini.requests);
  const results = gemini.requests[1].contents.at(-1).parts[0].functionResponse.response.listings;
  assert.deepEqual(results.map((l) => l.id), [item.id]);
  assert.ok(!sentToGemini.includes("Sokha"));
  assert.ok(!sentToGemini.includes(seller.email));
});

test("when Gemini's free quota is used up, students are told when to try again", async () => {
  const student = await api.createUser();
  try {
    gemini.limit = "minute";
    const busy = await ask(student, "a bike");
    assert.equal(busy.status, 429);
    assert.match(busy.body.error, /in a minute/);

    gemini.limit = "day";
    const done = await ask(student, "a bike");
    assert.equal(done.status, 429);
    assert.match(done.body.error, /tomorrow/);
  } finally {
    gemini.limit = null;
  }
});
