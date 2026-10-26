import assert from "node:assert/strict";
import { test } from "node:test";

// db/listings.js loads config.js, which requires these. No database connection is made.
process.env.DATABASE_URL ??= "postgres://unused";
process.env.JWT_SECRET ??= "unused";
const { buildBrowseQuery, wordMatchSql } = await import("../src/db/listings.js");

test("without a search term, listings are newest first", () => {
  const { text, params } = buildBrowseQuery({ status: "active" });
  assert.deepEqual(params, ["active", 100]);
  assert.match(text, /ORDER BY l\.created_at DESC/);
  assert.doesNotMatch(text, /websearch_to_tsquery/);
});

test("filters become numbered parameters, never pasted into the SQL", () => {
  const { text, params } = buildBrowseQuery({
    status: "active", category: "bikes", listingType: "trade", minPrice: 10, maxPrice: 100,
  });
  assert.deepEqual(params, ["active", "bikes", "trade", 10, 100, 100]); // the last 100 is the limit
  assert.match(text, /l\.listing_type = \$3/);
  assert.match(text, /l\.price >= \$4 AND l\.price <= \$5/);
});

test("a search term is ranked and typo tolerant, and stays a parameter", () => {
  const { text, params } = buildBrowseQuery({ status: "active", query: "' OR 1=1 --" });
  assert.deepEqual(params, ["active", "' OR 1=1 --", "%' OR 1=1 --%", 100]);
  assert.doesNotMatch(text, /OR 1=1/);
  assert.match(text, /websearch_to_tsquery\('english', \$2\)/);
  assert.match(text, /word_similarity\(\$2, l\.title\)/);
  assert.match(text, /ORDER BY ts_rank/);
});

test("the limit is a parameter too, 100 unless the caller gives one", () => {
  const { text, params } = buildBrowseQuery({ status: "active", query: "ram", limit: 5 });
  assert.equal(params.at(-1), 5);
  assert.match(text, /LIMIT \$4$/);
  assert.doesNotMatch(text, /LIMIT 5/);
  assert.match(buildBrowseQuery({ status: "active" }).text, /LIMIT \$2$/);
});

test("% and _ in a search term are literal characters, not wildcards", () => {
  const { params } = buildBrowseQuery({ status: "active", query: "50%_off" });
  assert.equal(params[2], "%50\\%\\_off%");
});

test("wanted-post matching uses search's full-text and typo tests, but not part-of-a-word", () => {
  const { matches, rank } = wordMatchSql("n", "t.term");
  assert.ok(matches.includes("n.search_vector @@ websearch_to_tsquery('english', t.term)"));
  assert.ok(matches.includes("word_similarity(t.term, n.title) >= 0.5"));
  assert.doesNotMatch(matches, /ILIKE/);
  assert.ok(rank.startsWith("ts_rank(n.search_vector"));
  // The search box still finds part of a word ("mac" in "MacBook").
  const { text } = buildBrowseQuery({ status: "active", query: "mac" });
  assert.ok(text.includes("l.title ILIKE $3"));
  assert.ok(text.includes("l.description ILIKE $3"));
});
