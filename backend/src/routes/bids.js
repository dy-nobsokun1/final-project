import { Router } from "express";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";
import { notifyOutbid } from "../utils/notify.js";
import { toBid } from "../utils/serializers.js";
import { minimumNextBid } from "../utils/validation.js";

// Mounted at /api/listings/:id/bids. mergeParams lets these routes read the listing's :id.
export const bidsRouter = Router({ mergeParams: true });

// GET /api/listings/:id/bids  -> every bid on an auction, highest first
bidsRouter.get("/", async (req, res) => {
  const { rows } = await query(
    `SELECT b.*, u.name AS bidder_name, u.is_verified AS bidder_is_verified
     FROM bids b JOIN users u ON u.id = b.bidder_id
     WHERE b.listing_id = $1
     ORDER BY b.amount DESC, b.created_at ASC`,
    [req.params.id],
  );
  res.json({ bids: rows.map(toBid) });
});

// POST /api/listings/:id/bids  { amount }  (logged in)
bidsRouter.post("/", requireAuth, async (req, res) => {
  const amount = req.body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Bid must be a number above 0.");
  }

  const bid = await withTransaction(async (client) => {
    // FOR UPDATE locks this listing row until the transaction ends, so two people bidding at the
    // same moment are handled one after the other and both see the true highest bid.
    const { rows } = await client.query(
      `SELECT user_id, listing_type, status, price, min_increment, auction_ends_at <= now() AS ended
       FROM listings WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );
    const listing = rows[0];
    if (!listing) throw new HttpError(404, "Listing not found.");
    if (listing.listing_type !== "auction") throw new HttpError(400, "This listing is not an auction.");
    if (listing.ended || listing.status !== "active") throw new HttpError(400, "This auction has ended.");
    if (listing.user_id === req.userId) throw new HttpError(403, "You cannot bid on your own auction.");

    const top = (await client.query(
      `SELECT amount, bidder_id FROM bids WHERE listing_id = $1
       ORDER BY amount DESC, created_at ASC LIMIT 1`,
      [req.params.id],
    )).rows[0];
    if (top?.bidder_id === req.userId) throw new HttpError(400, "You already have the highest bid.");

    const minimum = minimumNextBid({
      startingPrice: Number(listing.price),
      highestBid: top ? Number(top.amount) : null,
      minIncrement: Number(listing.min_increment),
    });
    if (amount < minimum) {
      throw new HttpError(400, `Your bid must be at least $${minimum}.`, { amount: `Minimum bid is $${minimum}.` });
    }

    const inserted = await client.query(
      "INSERT INTO bids (listing_id, bidder_id, amount) VALUES ($1, $2, $3) RETURNING *",
      [req.params.id, req.userId, amount],
    );
    return { ...inserted.rows[0], previousBidderId: top?.bidder_id ?? null };
  });

  // Only after the transaction is saved: tell the person who just lost the lead.
  if (bid.previousBidderId) {
    notifyOutbid({ listingId: req.params.id, previousBidderId: bid.previousBidderId, amount });
  }

  const { rows } = await query("SELECT name, is_verified FROM users WHERE id = $1", [req.userId]);
  res.status(201).json({
    bid: toBid({ ...bid, bidder_name: rows[0].name, bidder_is_verified: rows[0].is_verified }),
  });
});
