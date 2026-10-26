import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  askAssistant, forModel, MAX_ROUNDS, searchFilters, toWantedDraft, validateAssistantMessages,
} from "../src/utils/assistant.js";

// services/groq.js and services/gemini.js load config.js, which requires these. No network or
// database is used: the loop tests use a fake model, and the provider tests replace fetch.
process.env.DATABASE_URL ??= "postgres://unused";
process.env.JWT_SECRET ??= "unused";
const { askGroq } = await import("../src/services/groq.js");
const { askGemini } = await import("../src/services/gemini.js");

// The assistant's loop with a fake model: each test scripts what the "model" answers, in order,
// and records every request it was sent.
function fakeModel(...answers) {
  const requests = [];
  const ask = async (request) => {
    requests.push(structuredClone(request));
    return answers[requests.length - 1] ?? answers.at(-1);
  };
  return { ask, requests };
}

const call = (name, args, raw) => ({ text: "", calls: [{ id: `call-${name}`, name, args }], raw });

const listing = (id, fields = {}) => ({
  id, title: `Item ${id}`, description: "Works well", price: 10, cashTopup: null, category: "electronics",
  condition: "good", listingType: "sale", auction: null, seller: { id: "u1", name: "Sokunth", isVerified: true },
  ...fields,
});

const ask = (text) => [{ role: "user", text }];
const noSearch = async () => [];

test("searches, then shows only the found listings that the reply names", async () => {
  const searches = [];
  const searchListings = async (filters) => {
    searches.push(filters);
    return [
      listing("a"), listing("b"), listing("w", { listingType: "buy_request" }),
      listing("e", { listingType: "auction", auction: { ended: true, highestBid: null } }),
    ];
  };
  const model = fakeModel(
    call("search_listings", { query: "calculator", maxPrice: 20, listingType: "buy_request" }, { provider: "turn" }),
    call("reply", { text: "Item b looks best.", listingIds: ["b", "made-up", "b", "a"] }),
  );

  const result = await askAssistant(ask("cheap calculator?"), { ask: model.ask, searchListings });

  assert.equal(result.reply, "Item b looks best.");
  assert.deepEqual(result.listings.map((l) => l.id), ["b", "a"]); // no made-up id, no duplicate
  assert.equal(result.wantedDraft, null);
  // Same filters as browse; the model cannot ask for wanted posts.
  assert.equal(searches[0].query, "calculator");
  assert.equal(searches[0].maxPrice, 20);
  assert.equal(searches[0].status, "active");
  assert.equal(searches[0].listingType, undefined);

  // The model's turn (with the provider's own copy) goes back, then the results without seller details.
  const [first, second] = model.requests;
  assert.equal(first.onlyReply, false);
  assert.deepEqual(second.turns[1], {
    role: "assistant", raw: { provider: "turn" },
    calls: [{ id: "call-search_listings", name: "search_listings", args: { query: "calculator", maxPrice: 20, listingType: "buy_request" } }],
  });
  const [result1] = second.turns[2].results;
  assert.equal(result1.id, "call-search_listings");
  assert.deepEqual(result1.response.listings.map((l) => l.id), ["a", "b"]); // no wanted post or ended auction
  assert.ok(!JSON.stringify(second).includes("Sokunth"));
});

test("a wanted-post draft is cleaned up before it reaches the form", async () => {
  const model = fakeModel(call("reply", {
    text: "Here is a draft.",
    wantedDraft: { title: "  Casio fx-991  ", category: "gadgets", budget: -5 },
  }));
  const result = await askAssistant(ask("post a wanted request"), { ask: model.ask, searchListings: noSearch });
  assert.deepEqual(result.wantedDraft, { title: "Casio fx-991", description: "", category: "other", budget: 0 });

  assert.equal(toWantedDraft({ title: "  ", category: "bikes" }), null);
  assert.equal(toWantedDraft({ title: "x".repeat(200), category: "bikes", budget: 30 }).title.length, 120);
  assert.equal(toWantedDraft({ title: "Bike", category: "bikes", budget: 30 }).budget, 30);
});

test("plain text, unknown tools and a model that never replies are all handled", async () => {
  const text = fakeModel({ text: "No luck, sorry.", calls: [] });
  const plain = await askAssistant(ask("hi"), { ask: text.ask, searchListings: noSearch });
  assert.equal(plain.reply, "No luck, sorry.");
  // Replies are capped like messages, so the conversation can always be sent back.
  const long = fakeModel(call("reply", { text: "x".repeat(1500) }));
  const capped = await askAssistant(ask("hi"), { ask: long.ask, searchListings: noSearch });
  assert.equal(validateAssistantMessages([...ask("hi"), { role: "assistant", text: capped.reply }, ...ask("ok")]), null);

  const unknown = fakeModel(call("buy_item", { id: "a" }), call("reply", { text: "I can't buy things." }));
  await askAssistant(ask("buy it"), { ask: unknown.ask, searchListings: noSearch });
  assert.match(unknown.requests[1].turns[2].results[0].response.error, /no tool called buy_item/);

  const stuck = fakeModel(call("search_listings", { query: "lamp" }));
  const gaveUp = await askAssistant(ask("lamp"), { ask: stuck.ask, searchListings: async () => [listing("a")] });
  assert.equal(stuck.requests.length, MAX_ROUNDS);
  // Only the last call is limited to reply (this fake ignores that, a real model would answer).
  assert.deepEqual(stuck.requests.map((r) => r.onlyReply), [...Array(MAX_ROUNDS - 1).fill(false), true]);
  assert.match(gaveUp.reply, /Sorry/);
  assert.deepEqual(gaveUp.listings, []);
});

test("only valid conversations are accepted", () => {
  assert.equal(validateAssistantMessages(ask("a desk")), null);
  assert.match(validateAssistantMessages([]), /between 1 and/);
  assert.match(validateAssistantMessages("hi"), /between 1 and/);
  assert.match(validateAssistantMessages(Array(21).fill({ role: "user", text: "hi" })), /between 1 and/);
  assert.match(validateAssistantMessages([{ role: "system", text: "hi" }]), /role/);
  assert.match(validateAssistantMessages([{ role: "user", text: "  " }]), /role/);
  assert.match(validateAssistantMessages([{ role: "user", text: "x".repeat(1001) }]), /role/);
  assert.match(validateAssistantMessages([{ role: "user", text: "hi" }, { role: "assistant", text: "Hello" }]), /last message/);
});

test("the model sees listing basics only, and search drops unknown filter values", () => {
  const auction = listing("c", {
    listingType: "auction", description: "y".repeat(300), auction: { highestBid: 12, endsAt: "2026-11-01T00:00:00Z" },
  });
  assert.deepEqual(Object.keys(forModel(auction)).sort(),
    ["auctionEndsAt", "category", "condition", "description", "highestBid", "id", "price", "title", "type"]);
  assert.equal(forModel(auction).description.length, 200);
  assert.equal(forModel(listing("t", { listingType: "trade", cashTopup: 5 })).cashTopup, 5);

  const filters = searchFilters({ query: "  desk ", category: "toys", condition: "good", minPrice: "abc" });
  assert.equal(filters.query, "desk");
  assert.equal(filters.category, undefined);
  assert.equal(filters.condition, "good");
  assert.equal(filters.minPrice, undefined);
});

// The two providers, with fetch replaced by a script of their answers. Every request body is kept.
const realFetch = globalThis.fetch;
after(() => { globalThis.fetch = realFetch; });
function fakeFetch(...answers) {
  const bodies = [];
  globalThis.fetch = async (url, options) => {
    bodies.push(JSON.parse(options.body));
    const answer = answers[bodies.length - 1];
    return Response.json(answer.body, { status: answer.status ?? 200 });
  };
  return bodies;
}

const conversation = [
  { role: "user", text: "hi" }, { role: "assistant", text: "Hello! What do you need?" }, { role: "user", text: "a cheap lamp" },
];

test("Groq: OpenAI-style tool calls, a forced tool every round, and no seller details", async () => {
  const groqCall = (id, name, args) => ({
    body: { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: args } }] } }] },
  });
  const bodies = fakeFetch(
    groqCall("t1", "search_listings", JSON.stringify({ query: "lamp", maxPrice: 10 })),
    groqCall("t2", "search_listings", "{not json"), // a broken call counts as no arguments
    groqCall("t3", "reply", JSON.stringify({ text: "Item a is cheap.", listingIds: ["a"] })),
  );
  const result = await askAssistant(conversation, { ask: askGroq, searchListings: async () => [listing("a")] });
  assert.equal(result.reply, "Item a is cheap.");
  assert.deepEqual(result.listings.map((l) => l.id), ["a"]);

  const [first, , last] = bodies;
  assert.equal(first.messages[0].role, "system");
  assert.deepEqual(first.messages.slice(1).map((m) => [m.role, m.content]),
    [["user", "hi"], ["assistant", "Hello! What do you need?"], ["user", "a cheap lamp"]]);
  assert.deepEqual(first.tools.map((t) => [t.type, t.function.name]), [["function", "search_listings"], ["function", "reply"]]);
  assert.equal(first.tool_choice, "required");
  assert.deepEqual(last.tool_choice, { type: "function", function: { name: "reply" } });
  // The call goes back with its id, then the result as a "tool" message linked to it.
  const [asked, answered] = last.messages.slice(4, 6);
  assert.deepEqual(asked.tool_calls[0], { id: "t1", type: "function", function: { name: "search_listings", arguments: '{"query":"lamp","maxPrice":10}' } });
  assert.equal(answered.role, "tool");
  assert.equal(answered.tool_call_id, "t1");
  assert.deepEqual(JSON.parse(answered.content).listings.map((l) => l.id), ["a"]);
  assert.equal(last.messages[6].tool_calls[0].function.arguments, "{}");
  assert.ok(!JSON.stringify(bodies).includes("Sokunth"));
});

test("Groq: a 429 says whether the minute's or the day's limit is used up", async () => {
  const limit = (message) => ({ status: 429, body: { error: { message, type: "requests", code: "rate_limit_exceeded" } } });
  fakeFetch(limit("Rate limit reached for model `qwen/qwen3.8-27b` on input tokens per minute (ITPM): Limit 7000, Used 6850, Requested 1225. Please try again in 9.2s."));
  await assert.rejects(askAssistant(ask("lamp"), { ask: askGroq, searchListings: noSearch }), { status: 429, dailyLimit: false });
  fakeFetch(limit("Rate limit reached for model `qwen/qwen3.8-27b` on tokens per day (TPD): Limit 200000, Used 199500. Please try again in 7m12s."));
  await assert.rejects(askAssistant(ask("lamp"), { ask: askGroq, searchListings: noSearch }), { status: 429, dailyLimit: true });
});

test("Gemini: user and model turns, and its signed tool calls go back unchanged", async () => {
  const signed = { role: "model", parts: [{ functionCall: { id: "g1", name: "search_listings", args: { query: "lamp" } }, thoughtSignature: "sig-1" }] };
  const bodies = fakeFetch(
    { body: { candidates: [{ content: signed }] } },
    { body: { candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "g2", name: "reply", args: { text: "Found it.", listingIds: ["a"] } } }] } }] } },
  );
  const result = await askAssistant(conversation, { ask: askGemini, searchListings: async () => [listing("a")] });
  assert.equal(result.reply, "Found it.");
  assert.deepEqual(result.listings.map((l) => l.id), ["a"]);

  const [first, second] = bodies;
  assert.deepEqual(first.contents.map((c) => c.role), ["user", "model", "user"]);
  assert.equal(first.contents[1].parts[0].text, "Hello! What do you need?");
  assert.deepEqual(first.toolConfig.functionCallingConfig, { mode: "ANY" });
  assert.deepEqual(second.contents[3], signed);
  const { functionResponse } = second.contents[4].parts[0];
  assert.equal(functionResponse.id, "g1");
  assert.deepEqual(functionResponse.response.listings.map((l) => l.id), ["a"]);
  assert.ok(!JSON.stringify(bodies).includes("Sokunth"));
});
