import { Router } from "express";
import { findListingById } from "../db/listings.js";
import { declinePendingOffers, findOfferById, lockOffer, OFFER_SELECT } from "../db/offers.js";
import { confirmOpenKhqrPayments, PAYMENT_MINUTES } from "../db/payments.js";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";
import { notifyOfferAccepted, notifyOfferDeclined, notifyOfferMade } from "../utils/notify.js";
import { toOffer } from "../utils/serializers.js";
import { isUuid } from "../utils/validation.js";

// Price offers ("make an offer"). A buyer offers less than the asking price of an item for sale; the
// seller accepts it, which reserves the item for that buyer at that price (listings.reserved_for),
// or declines it. Only the reserved buyer can then pay online, at the offer's price (amountToPay in
// utils/payments.js), or they meet and pay in person. Auctions, trades, giveaways and wanted posts
// take no offers. Every change locks the listing's row first (see db/offers.js).

// Mounted at /api/listings/:id/offers and /api/offers. mergeParams lets the first one read :id.
// A malformed listing id becomes 404 in errorHandler.
export const listingOffersRouter = Router({ mergeParams: true });
export const offersRouter = Router();

const NOT_OPEN = "This offer is no longer open: the buyer withdrew or changed it, or it was already answered.";
const ONLY_SELLER = "Only the seller can accept or decline this offer.";

/** "$25" or "$24.50", for the messages below. */
function dollars(value) {
  const amount = Number(value);
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

// POST /api/listings/:id/offers  { amount }  (logged in) -> 201 { offer }
listingOffersRouter.post("/", requireAuth, async (req, res) => {
  const raw = req.body?.amount; // req.body is undefined without a JSON body
  // Rounded to cents first, as NUMERIC(10, 2) would, so 24.999 cannot slip under a $25 price.
  const amount = typeof raw === "number" ? Math.round(raw * 100) / 100 : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Offer must be a number above 0.", { amount: "Offer must be a number above 0." });
  }

  const offer = await withTransaction(async (client) => {
    const { rows: [listing] } = await client.query(
      "SELECT user_id, listing_type, status, price FROM listings WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!listing) throw new HttpError(404, "Listing not found.");
    if (listing.user_id === req.userId) throw new HttpError(403, "You cannot make an offer on your own listing.");
    if (listing.listing_type !== "sale") throw new HttpError(400, "Offers are only for items for sale.");
    if (listing.status !== "active") throw new HttpError(400, "This item is no longer available.");
    const price = Number(listing.price);
    if (price <= 0) throw new HttpError(400, "This item has no price to make an offer on.");
    if (amount >= price) {
      throw new HttpError(400, `Offer less than the asking price of ${dollars(price)}. At that price, just pay for it.`,
        { amount: `Must be below ${dollars(price)}.` });
    }

    // A new amount replaces the buyer's pending offer, so the seller can never accept an amount
    // that changed under them: the old offer's id stops working.
    await client.query(
      `UPDATE offers SET status = 'withdrawn', updated_at = now()
       WHERE listing_id = $1 AND buyer_id = $2 AND status = 'pending'`,
      [req.params.id, req.userId],
    );
    const { rows: [created] } = await client.query(
      "INSERT INTO offers (listing_id, buyer_id, amount) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, req.userId, amount],
    );
    return created;
  });

  // Only after the transaction is saved: tell the seller.
  notifyOfferMade(offer);
  res.status(201).json({ offer: toOffer(await findOfferById(offer.id)) });
});

// GET /api/listings/:id/offers  (the seller only) -> { offers }: the open ones, highest first, and the accepted one
listingOffersRouter.get("/", requireAuth, async (req, res) => {
  const listing = await findListingById(req.params.id);
  if (!listing) throw new HttpError(404, "Listing not found.");
  if (listing.user_id !== req.userId) throw new HttpError(403, "Only the seller can see the offers on a listing.");
  const { rows } = await query(
    `${OFFER_SELECT}
     WHERE o.listing_id = $1 AND o.status IN ('pending', 'accepted')
     ORDER BY o.amount DESC, o.created_at ASC`,
    [listing.id],
  );
  res.json({ offers: rows.map(toOffer) });
});

// GET /api/listings/:id/offers/mine  (logged in) -> { offer }: your latest offer on it, in any status, or null
listingOffersRouter.get("/mine", requireAuth, async (req, res) => {
  const { rows } = await query(
    `${OFFER_SELECT} WHERE o.listing_id = $1 AND o.buyer_id = $2 ORDER BY o.created_at DESC LIMIT 1`,
    [req.params.id, req.userId],
  );
  res.json({ offer: rows[0] ? toOffer(rows[0]) : null });
});

// POST /api/offers/:id/accept  (the seller) -> { offer }
// Reserves the item for the offer's buyer at the offer's price, and declines every other open offer.
offersRouter.post("/:id/accept", requireAuth, async (req, res) => {
  if (!isUuid(req.params.id)) throw new HttpError(404, "Offer not found.");
  const { rows: [found] } = await query(
    "SELECT o.listing_id, l.user_id FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.id = $1",
    [req.params.id],
  );
  if (!found) throw new HttpError(404, "Offer not found.");
  if (found.user_id !== req.userId) throw new HttpError(403, ONLY_SELLER);
  // Record any paid-but-unconfirmed KHQR first, as PATCH does before "sold": that buyer's payment then
  // counts as the sale, and the offer cannot be accepted. Outside the transaction, because markPaid
  // locks the same listing row on its own connection. If Bakong cannot be asked, the seller is not blocked.
  await confirmOpenKhqrPayments(found.listing_id).catch((error) => console.error("[bakong]", error.message));

  const { offer, declined } = await withTransaction(async (client) => {
    const { offer, listing } = await lockOffer(client, req.params.id);
    if (listing.user_id !== req.userId) throw new HttpError(403, ONLY_SELLER);
    if (offer.status !== "pending") throw new HttpError(409, NOT_OPEN);
    if (listing.listing_type !== "sale" || listing.status !== "active") {
      throw new HttpError(409, "This item is no longer available, so the offer cannot be accepted.");
    }
    if (Number(offer.amount) >= Number(listing.price)) {
      throw new HttpError(409, "Your asking price is now at or below this offer, so the buyer can pay it directly. Decline this offer instead.");
    }
    // Same one-buyer-pays-at-a-time rule as lockListingForPayment: someone else who started paying
    // in the last PAYMENT_MINUTES keeps their chance. The offer's own buyer paying does not block.
    const { rows: paying } = await client.query(
      `SELECT 1 FROM payments
       WHERE listing_id = $1 AND status = 'pending' AND buyer_id <> $2
         AND created_at > now() - make_interval(mins => $3)
       LIMIT 1`,
      [listing.id, offer.buyer_id, PAYMENT_MINUTES],
    );
    if (paying.length) {
      throw new HttpError(409, `Another buyer is paying for this right now. Try again in ${PAYMENT_MINUTES} minutes.`);
    }

    await client.query(
      "UPDATE offers SET status = 'accepted', updated_at = now() WHERE id = $1 AND status = 'pending'", [offer.id]);
    const declined = await declinePendingOffers(client, listing.id);
    await client.query(
      "UPDATE listings SET status = 'reserved', reserved_for = $2, updated_at = now() WHERE id = $1",
      [listing.id, offer.buyer_id],
    );
    return { offer, declined };
  });

  // Only after the transaction is saved: tell the buyer who got it, and the others.
  notifyOfferAccepted(offer);
  for (const row of declined) notifyOfferDeclined(row);
  res.json({ offer: toOffer(await findOfferById(offer.id)) });
});

// POST /api/offers/:id/decline  (the seller) -> { offer }. The listing stays as it is.
offersRouter.post("/:id/decline", requireAuth, async (req, res) => {
  const offer = await withTransaction(async (client) => {
    const { offer, listing } = await lockOffer(client, req.params.id);
    if (listing.user_id !== req.userId) throw new HttpError(403, ONLY_SELLER);
    if (offer.status !== "pending") throw new HttpError(409, NOT_OPEN);
    await client.query("UPDATE offers SET status = 'declined', updated_at = now() WHERE id = $1", [offer.id]);
    return offer;
  });

  notifyOfferDeclined(offer);
  res.json({ offer: toOffer(await findOfferById(offer.id)) });
});

// POST /api/offers/:id/withdraw  (the buyer who made it) -> { offer }. Pending offers only; nobody is notified.
offersRouter.post("/:id/withdraw", requireAuth, async (req, res) => {
  const offer = await withTransaction(async (client) => {
    const { offer } = await lockOffer(client, req.params.id);
    if (offer.buyer_id !== req.userId) throw new HttpError(403, "Only the buyer who made this offer can withdraw it.");
    if (offer.status === "accepted") {
      throw new HttpError(409, "Your offer was accepted, so the item is reserved for you. If you no longer want it, message the seller so they can make it available again.");
    }
    if (offer.status !== "pending") throw new HttpError(409, "Only a pending offer can be withdrawn.");
    await client.query("UPDATE offers SET status = 'withdrawn', updated_at = now() WHERE id = $1", [offer.id]);
    return offer;
  });

  res.json({ offer: toOffer(await findOfferById(offer.id)) });
});
