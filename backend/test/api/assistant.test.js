import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

// The assistant is switched on for this file, but Groq itself is replaced. The fake searches for
// the student's last message, then replies showing the first listing it found. While `groq.limit`
// is "minute" or "day", it answers 429 for that free limit. Every request body is kept in `groq.requests`.
// Both keys are set, so Groq must be picked over Gemini; a call to Gemini fails the test.
// All other requests (the tests calling our API) go through as normal.
const realFetch = globalThis.fetch;
const groq = { limit: null, requests: [] };
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith("https://generativelanguage.googleapis.com/")) throw new Error("Gemini was called instead of Groq");
  if (!String(url).startsWith("https://api.groq.com/")) return realFetch(url, options);
  if (groq.limit) {
    const message = `Rate limit reached for model \`openai/gpt-oss-120b\` on requests per ${groq.limit} (RP${groq.limit[0].toUpperCase()}): Limit 30, Used 30, Requested 1. Please try again in 2s.`;
    return Response.json({ error: { message, type: "requests", code: "rate_limit_exceeded" } }, { status: 429 });
  }
  const body = JSON.parse(options.body);
  groq.requests.push(body);
  const last = body.messages.at(-1);
  const [name, args] = last.role === "tool"
    ? ["reply", { text: "Found one.", listingIds: JSON.parse(last.content).listings.map((l) => l.id).slice(0, 1) }]
    : ["search_listings", { query: last.content }];
  const toolCall = { id: `call-${groq.requests.length}`, type: "function", function: { name, arguments: JSON.stringify(args) } };
  return Response.json({ choices: [{ message: { role: "assistant", content: null, tool_calls: [toolCall] } }] });
};

const api = await startApi({ env: { GROQ_API_KEY: "test-key", GEMINI_API_KEY: "test-key" } });
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

test("finds a real listing, leaves wanted posts out, and sends Groq no seller details", async () => {
  const word = `zebralamp${randomUUID().slice(0, 6)}`;
  const seller = await api.createUser("Seller Sokha");
  const [student, wanter] = await Promise.all([api.createUser(), api.createUser()]);
  await api.createListing(wanter, { title: `Looking for ${word}`, listingType: "buy_request", price: 0 });
  const item = await api.createListing(seller, { title: `${word} desk lamp`, category: "furniture", price: 8 });

  groq.requests.length = 0;
  const response = await ask(student, word);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.reply, "Found one.");
  assert.deepEqual(response.body.listings.map((l) => l.id), [item.id]);
  assert.equal(response.body.listings[0].seller.name, "Seller Sokha"); // the card gets the full listing
  assert.equal(response.body.wantedDraft, null);

  const sentToGroq = JSON.stringify(groq.requests);
  const results = JSON.parse(groq.requests[1].messages.at(-1).content).listings;
  assert.deepEqual(results.map((l) => l.id), [item.id]);
  assert.ok(!sentToGroq.includes("Sokha"));
  assert.ok(!sentToGroq.includes(seller.email));
});

test("when Groq's free limit is used up, students are told when to try again", async () => {
  const student = await api.createUser();
  try {
    groq.limit = "minute";
    const busy = await ask(student, "a bike");
    assert.equal(busy.status, 429);
    assert.match(busy.body.error, /in a minute/);

    groq.limit = "day";
    const done = await ask(student, "a bike");
    assert.equal(done.status, 429);
    assert.match(done.body.error, /tomorrow/);
  } finally {
    groq.limit = null;
  }
});
