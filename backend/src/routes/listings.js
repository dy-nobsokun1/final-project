import { Router } from "express";
import { buildBrowseQuery, findListingById } from "../db/listings.js";
import { confirmOpenKhqrPayments, RECHECK_HOURS } from "../db/payments.js";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";
import { toListing } from "../utils/serializers.js";
import { parseListingFilters, validateListing } from "../utils/validation.js";

export const listingsRouter = Router();

// Request field (camelCase) -> database column. Only these can be written by clients.
const WRITABLE_COLUMNS = {
  title: "title",
  description: "description",
  category: "category",
  condition: "condition",
  listingType: "listing_type",
  price: "price",
  cashTopup: "cash_topup",
  imageUrls: "image_urls",
  status: "status",
  auctionEndsAt: "auction_ends_at",
  minIncrement: "min_increment",
};

// Once someone has bid, these would change the deal under the bidders' feet, so they are locked.
const LOCKED_AFTER_BIDS = ["listingType", "price", "auctionEndsAt", "minIncrement"];

function assertValid(body, options) {
  const errors = validateListing(body, options);
  if (Object.keys(errors).length) throw new HttpError(400, "Please fix the highlighted fields.", errors);
}

async function findOwnedListing(id, userId) {
  const listing = await findListingById(id);
  if (!listing) throw new HttpError(404, "Listing not found.");
  if (listing.user_id !== userId) throw new HttpError(403, "You can only change your own listings.");
  return listing;
}

// GET /api/listings?query=&category=&condition=&type=&minPrice=&maxPrice=&status=
// With `query`, results are ranked best match first and tolerate small typos (see buildBrowseQuery).
listingsRouter.get("/", async (req, res) => {
  const { text, params } = buildBrowseQuery(parseListingFilters(req.query));
  const { rows } = await query(text, params);
  res.json({ listings: rows.map(toListing) });
});

// GET /api/listings/:id
listingsRouter.get("/:id", async (req, res) => {
  const listing = await findListingById(req.params.id);
  if (!listing) throw new HttpError(404, "Listing not found.");
  res.json({ listing: toListing(listing) });
});

// POST /api/listings  (logged in)
listingsRouter.post("/", requireAuth, async (req, res) => {
  assertValid(req.body);
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO listings
       (user_id, title, description, category, condition, listing_type, price, cash_topup, image_urls,
        auction_ends_at, min_increment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [req.userId, b.title.trim(), b.description ?? "", b.category, b.condition,
      b.listingType ?? "sale", b.price ?? 0, b.cashTopup ?? null, b.imageUrls ?? [],
      // An end time only means something for an auction.
      b.listingType === "auction" ? b.auctionEndsAt : null, b.minIncrement ?? 1],
  );
  res.status(201).json({ listing: toListing(await findListingById(rows[0].id)) });
});

// PATCH /api/listings/:id  (owner only) -- any subset of fields, e.g. { "status": "sold" }
listingsRouter.patch("/:id", requireAuth, async (req, res) => {
  const listing = await findOwnedListing(req.params.id, req.userId);
  assertValid(req.body, { partial: true });

  const changes = { ...req.body };
  const fields = Object.keys(WRITABLE_COLUMNS).filter((field) => changes[field] !== undefined);
  if (!fields.length) throw new HttpError(400, "Nothing to update.");

  if (listing.bid_count > 0) {
    const locked = fields.filter((field) => LOCKED_AFTER_BIDS.includes(field));
    if (locked.length) {
      throw new HttpError(409, "People have already bid, so the type, price and auction settings are locked.");
    }
  }
  // A seller who saw a KHQR payment arrive in their bank app may mark the item sold before UniSwap
  // confirmed it (e.g. Bakong was down). Record such payments first, so the buyer's payment counts
  // as the sale instead of becoming a refund. If Bakong cannot be asked, the seller is not blocked.
  if ((changes.status === "sold" || changes.status === "traded") && listing.status !== changes.status) {
    await confirmOpenKhqrPayments(listing.id).catch((error) => console.error("[bakong]", error.message));
  }
  // A listing someone paid for online stays with that sale: its payment and reviews point at that
  // buyer, and nobody could pay for it online again. Selling it again means a new listing.
  if (changes.status === "active" && listing.status !== "active") {
    const { rows: paid } = await query("SELECT 1 FROM payments WHERE listing_id = $1 AND status = 'paid' LIMIT 1", [listing.id]);
    if (paid.length) {
      throw new HttpError(409, "Someone paid for this online, so it cannot be made available again. If the deal fell through and you refunded them, post the item again as a new listing.");
    }
  }
  const nextType = changes.listingType ?? listing.listing_type;
  if (nextType === "auction" && !(changes.auctionEndsAt ?? listing.auction_ends_at)) {
    throw new HttpError(400, "An auction needs an end date and time.", { auctionEndsAt: "Required for an auction." });
  }
  // Switching away from an auction clears its end time.
  if (nextType !== "auction" && listing.auction_ends_at) {
    changes.auctionEndsAt = null;
    if (!fields.includes("auctionEndsAt")) fields.push("auctionEndsAt");
  }

  // Column names come from our own whitelist above; values are always $n parameters.
  const setSql = fields.map((field, i) => `${WRITABLE_COLUMNS[field]} = $${i + 2}`).join(", ");
  await query(
    `UPDATE listings SET ${setSql}, updated_at = now() WHERE id = $1`,
    [req.params.id, ...fields.map((field) => changes[field])],
  );
  res.json({ listing: toListing(await findListingById(req.params.id)) });
});

// DELETE /api/listings/:id  (owner only)
// Deleting a listing also deletes its payments and reviews (ON DELETE CASCADE in schema.sql), so it
// is refused (409) once that history matters: the item was sold or traded, it has reviews, money was
// paid for it, or a payment for it may still be confirmed. That payment would be lost with no record.
listingsRouter.delete("/:id", requireAuth, async (req, res) => {
  await findOwnedListing(req.params.id, req.userId);

  await withTransaction(async (client) => {
    // The same row lock a buyer takes when they start paying, so nobody can start in between.
    const { rows: [listing] } = await client.query(
      "SELECT status FROM listings WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!listing) throw new HttpError(404, "Listing not found.");
    if (listing.status === "sold" || listing.status === "traded") {
      throw new HttpError(409, "Sold and traded listings stay on your public profile as a record of the deal, so they cannot be deleted.");
    }
    // Also after "Make available again": its reviews must not disappear with it.
    const { rows: reviews } = await client.query("SELECT 1 FROM reviews WHERE listing_id = $1 LIMIT 1", [req.params.id]);
    if (reviews.length) throw new HttpError(409, "People have reviewed this deal, so the listing cannot be deleted.");

    // An unconfirmed payment may still be confirmed for RECHECK_HOURS (see server.js). The extra
    // minute makes it unlikely that a check still waiting for Bakong loses its payment to a delete.
    const { rows: payments } = await client.query(
      `SELECT status, ceil(extract(epoch FROM created_at + make_interval(mins => $2) - now()) / 60)::int AS minutes_left
       FROM payments
       WHERE listing_id = $1 AND (status <> 'pending' OR created_at > now() - make_interval(mins => $2))`,
      [req.params.id, RECHECK_HOURS * 60 + 1],
    );
    if (payments.some((payment) => payment.status !== "pending")) {
      throw new HttpError(409, "Someone has paid for this listing, so it cannot be deleted. Mark it reserved or sold to take it off the browse page.");
    }
    if (payments.length) {
      const minutes = Math.max(...payments.map((payment) => payment.minutes_left));
      const plural = (count, unit) => (count ? `${count} ${unit}${count === 1 ? "" : "s"}` : "");
      const wait = [plural(Math.floor(minutes / 60), "hour"), plural(minutes % 60, "minute")].filter(Boolean).join(" and ");
      throw new HttpError(409, `A payment for this listing has not been confirmed yet, so it cannot be deleted for another ${wait}. Mark it reserved to take it off the browse page meanwhile.`);
    }

    await client.query("DELETE FROM listings WHERE id = $1", [req.params.id]);
  });
  res.status(204).end();
});
