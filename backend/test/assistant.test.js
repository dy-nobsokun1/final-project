import assert from "node:assert/strict";
import { test } from "node:test";
import {
  askAssistant, forModel, MAX_ROUNDS, searchFilters, toWantedDraft, validateAssistantMessages,
} from "../src/utils/assistant.js";

// The assistant's loop with a fake Gemini: each test scripts what the "model" answers, in order,
// and records every request it was sent. No network, API key or database is used.

function fakeModel(...answers) {
  const requests = [];
  const generate = async (request) => {
    requests.push(structuredClone(request));
    return answers[requests.length - 1] ?? answers.at(-1);
  };
  return { generate, requests };
}

const call = (name, args, extra = {}) => ({ role: "model", parts: [{ functionCall: { id: `call-${name}`, name, args }, ...extra }] });

const listing = (id, fields = {}) => ({
  id, title: `Item ${id}`, description: "Works well", price: 10, cashTopup: null, category: "electronics",
  condition: "good", listingType: "sale", auction: null, seller: { id: "u1", name: "Sokunth", isVerified: true },
  ...fields,
});

const ask = (text) => [{ role: "user", text }];

test("searches, then shows only the found listings that the reply names", async () => {
  const searches = [];
  const searchListings = async (filters) => {
    searches.push(filters);
    return [listing("a"), listing("b"), listing("w", { listingType: "buy_request" })];
  };
  const model = fakeModel(
    call("search_listings", { query: "calculator", maxPrice: 20, listingType: "buy_request" }, { thoughtSignature: "sig-1" }),
    call("reply", { text: "Item b looks best.", listingIds: ["b", "made-up", "b", "a"] }),
  );

  const result = await askAssistant(ask("cheap calculator?"), { generate: model.generate, searchListings });

  assert.equal(result.reply, "Item b looks best.");
  assert.deepEqual(result.listings.map((l) => l.id), ["b", "a"]); // no made-up id, no duplicate
  assert.equal(result.wantedDraft, null);
  // Same filters as browse; Gemini cannot ask for wanted posts.
  assert.equal(searches[0].query, "calculator");
  assert.equal(searches[0].maxPrice, 20);
  assert.equal(searches[0].status, "active");
  assert.equal(searches[0].listingType, undefined);

  // The model's signed turn goes back unchanged, followed by the search results without seller details.
  const [, second] = model.requests;
  assert.deepEqual(second.contents[1].parts[0], { functionCall: { id: "call-search_listings", name: "search_listings", args: { query: "calculator", maxPrice: 20, listingType: "buy_request" } }, thoughtSignature: "sig-1" });
  const { functionResponse } = second.contents[2].parts[0];
  assert.equal(functionResponse.id, "call-search_listings");
  assert.deepEqual(functionResponse.response.listings.map((l) => l.id), ["a", "b"]); // wanted post left out
  assert.ok(!JSON.stringify(second).includes("Sokunth"));
});

test("sends earlier messages as user and model turns", async () => {
  const model = fakeModel(call("reply", { text: "Sure." }));
  const messages = [
    { role: "user", text: "hi" }, { role: "assistant", text: "Hello! What do you need?" }, { role: "user", text: "a bike" },
  ];
  await askAssistant(messages, { generate: model.generate, searchListings: async () => [] });
  assert.deepEqual(model.requests[0].contents.map((c) => c.role), ["user", "model", "user"]);
  assert.equal(model.requests[0].contents[1].parts[0].text, "Hello! What do you need?");
});

test("a wanted-post draft is cleaned up before it reaches the form", async () => {
  const model = fakeModel(call("reply", {
    text: "Here is a draft.",
    wantedDraft: { title: "  Casio fx-991  ", category: "gadgets", budget: -5 },
  }));
  const result = await askAssistant(ask("post a wanted request"), { generate: model.generate, searchListings: async () => [] });
  assert.deepEqual(result.wantedDraft, { title: "Casio fx-991", description: "", category: "other", budget: 0 });

  assert.equal(toWantedDraft({ title: "  ", category: "bikes" }), null);
  assert.equal(toWantedDraft({ title: "x".repeat(200), category: "bikes", budget: 30 }).title.length, 120);
  assert.equal(toWantedDraft({ title: "Bike", category: "bikes", budget: 30 }).budget, 30);
});

test("plain text, unknown tools and a model that never replies are all handled", async () => {
  const text = fakeModel({ role: "model", parts: [{ text: "thinking...", thought: true }, { text: "No luck, sorry." }] });
  const plain = await askAssistant(ask("hi"), { generate: text.generate, searchListings: async () => [] });
  assert.equal(plain.reply, "No luck, sorry.");
  // Replies are capped like messages, so the conversation can always be sent back.
  const long = fakeModel(call("reply", { text: "x".repeat(1500) }));
  const capped = await askAssistant(ask("hi"), { generate: long.generate, searchListings: async () => [] });
  assert.equal(validateAssistantMessages([...ask("hi"), { role: "assistant", text: capped.reply }, ...ask("ok")]), null);

  const unknown = fakeModel(call("buy_item", { id: "a" }), call("reply", { text: "I can't buy things." }));
  await askAssistant(ask("buy it"), { generate: unknown.generate, searchListings: async () => [] });
  assert.match(unknown.requests[1].contents[2].parts[0].functionResponse.response.error, /no tool called buy_item/);

  const stuck = fakeModel(call("search_listings", { query: "lamp" }));
  const gaveUp = await askAssistant(ask("lamp"), { generate: stuck.generate, searchListings: async () => [listing("a")] });
  assert.equal(stuck.requests.length, MAX_ROUNDS);
  // Only the last call is limited to reply (this fake ignores that, a real Gemini would answer).
  const allowed = stuck.requests.map((r) => r.toolConfig.functionCallingConfig.allowedFunctionNames);
  assert.deepEqual(allowed, [...Array(MAX_ROUNDS - 1).fill(undefined), ["reply"]]);
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

test("Gemini sees listing basics only, and search drops unknown filter values", () => {
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
