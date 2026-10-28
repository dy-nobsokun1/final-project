import assert from "node:assert/strict";
import { test } from "node:test";
import { amountToPay } from "../src/utils/payments.js";

// Rows shaped like LISTING_SELECT's (db/listings.js): prices arrive as PostgreSQL's "25.00" strings.
const forSale = { user_id: "s", listing_type: "sale", status: "active", price: "25.00", reserved_for: null, agreed_price: null };

test("an item for sale costs its price, and its owner cannot pay for it", () => {
  assert.equal(amountToPay(forSale, "b"), 25);
  assert.throws(() => amountToPay(forSale, "s"), { status: 400 });
});

test("an item reserved by an accepted offer can be paid only by that buyer, at the agreed price", () => {
  const reserved = { ...forSale, status: "reserved", reserved_for: "a", agreed_price: "17.50" };
  assert.equal(amountToPay(reserved, "a"), 17.5);
  assert.throws(() => amountToPay(reserved, "b"), { status: 403 });
});

test("the reserved buyer pays the asking price instead once the seller lowers it below the agreed price", () => {
  const reserved = { ...forSale, status: "reserved", reserved_for: "a", agreed_price: "20.00" };
  assert.equal(amountToPay({ ...reserved, price: "30.00" }, "a"), 20);
  assert.equal(amountToPay({ ...reserved, price: "15.00" }, "a"), 15);
  assert.throws(() => amountToPay({ ...reserved, price: "0.00" }, "a"), { status: 400 });
});

test("an item reserved by its owner without an offer cannot be paid online", () => {
  assert.throws(() => amountToPay({ ...forSale, status: "reserved" }, "b"), { status: 400 });
});

test("a won auction is still paid at the highest bid", () => {
  const auction = { ...forSale, listing_type: "auction", status: "reserved", leading_bidder_id: "w", highest_bid: "30.00" };
  assert.equal(amountToPay(auction, "w"), 30);
  assert.throws(() => amountToPay(auction, "x"), { status: 403 });
});
