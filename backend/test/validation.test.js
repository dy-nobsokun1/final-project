import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCampusEmail,
  minimumNextBid,
  parseListingFilters,
  validateListing,
  validateRegistration,
  validateReview,
} from "../src/utils/validation.js";

test("only .edu.kh emails are campus emails", () => {
  assert.equal(isCampusEmail("student@aupp.edu.kh"), true);
  assert.equal(isCampusEmail("Student@AUPP.EDU.KH"), true);
  assert.equal(isCampusEmail("student@gmail.com"), false);
  assert.equal(isCampusEmail("student@edu.kh.evil.com"), false);
  assert.equal(isCampusEmail("not-an-email"), false);
  assert.equal(isCampusEmail(undefined), false);
});

test("registration needs a name, campus email and 8+ char password", () => {
  assert.deepEqual(
    validateRegistration({ name: "Dara", email: "dara@aupp.edu.kh", password: "longenough" }),
    {},
  );
  const errors = validateRegistration({ name: " ", email: "dara@gmail.com", password: "short" });
  assert.deepEqual(Object.keys(errors).sort(), ["email", "name", "password"]);
});

test("registration accepts an optional major and a whole-number graduation year", () => {
  const base = { name: "Dara", email: "dara@aupp.edu.kh", password: "longenough" };
  assert.deepEqual(validateRegistration({ ...base, major: "Business", graduationYear: 2028 }), {});
  assert.deepEqual(
    Object.keys(validateRegistration({ ...base, major: 5, graduationYear: "2028" })).sort(),
    ["graduationYear", "major"],
  );
});

test("a full listing must have title, category and condition", () => {
  const errors = validateListing({});
  assert.deepEqual(Object.keys(errors).sort(), ["category", "condition", "title"]);
  assert.deepEqual(validateListing({ title: "Desk", category: "furniture", condition: "good" }), {});
});

test("a partial update only checks the fields it sends", () => {
  assert.deepEqual(validateListing({ status: "sold" }, { partial: true }), {});
  assert.ok(validateListing({ status: "stolen" }, { partial: true }).status);
  assert.ok(validateListing({ price: -5 }, { partial: true }).price);
});

test("browse filters ignore unknown values and default to active listings", () => {
  const filters = parseListingFilters({ category: "cars", minPrice: "10", maxPrice: "abc", query: " bike " });
  assert.equal(filters.category, undefined);
  assert.equal(filters.minPrice, 10);
  assert.equal(filters.maxPrice, undefined);
  assert.equal(filters.query, "bike");
  assert.equal(filters.status, "active");
});

test("an auction needs a future end time within 30 days and a positive minimum raise", () => {
  const base = { title: "Desk", category: "furniture", condition: "good", listingType: "auction" };
  const inDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  assert.deepEqual(validateListing({ ...base, auctionEndsAt: inDays(3), minIncrement: 2 }), {});
  assert.ok(validateListing(base).auctionEndsAt, "missing end time");
  assert.ok(validateListing({ ...base, auctionEndsAt: inDays(-1) }).auctionEndsAt, "in the past");
  assert.ok(validateListing({ ...base, auctionEndsAt: inDays(31) }).auctionEndsAt, "too far ahead");
  assert.ok(validateListing({ ...base, auctionEndsAt: "soon" }).auctionEndsAt, "not a date");
  assert.ok(validateListing({ minIncrement: 0 }, { partial: true }).minIncrement);
});

test("the first bid must reach the starting price; later bids must beat the highest by the raise", () => {
  assert.equal(minimumNextBid({ startingPrice: 20, highestBid: null, minIncrement: 2 }), 20);
  assert.equal(minimumNextBid({ startingPrice: 20, highestBid: 22, minIncrement: 2 }), 24);
});

test("a review names who it is about and gives 1 to 5 whole stars; the comment is optional", () => {
  assert.deepEqual(validateReview({ revieweeId: "u1", rating: 5, comment: "Smooth handover" }), {});
  assert.deepEqual(validateReview({ revieweeId: "u1", rating: 1 }), {});
  for (const rating of [0, 6, 4.5, "5", undefined]) {
    assert.ok(validateReview({ revieweeId: "u1", rating }).rating, `rating ${rating}`);
  }
  assert.ok(validateReview({ revieweeId: "u1", rating: 3, comment: "x".repeat(1001) }).comment);
  assert.ok(validateReview({ rating: 3 }).revieweeId);
});
