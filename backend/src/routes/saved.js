import { Router } from "express";
import { LISTING_SELECT } from "../db/listings.js";
import { query } from "../db/pool.js";
import { saveListing, unsaveListing } from "../db/saved.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";
import { toListing } from "../utils/serializers.js";

// Saved listings (the heart): a private bookmark from one student to one listing. Only the saver
// sees their list; a listing shows just how many students saved it (save_count in LISTING_SELECT).
// Saving uses POST, not PUT: cors.js and the rest of the API use no PUT, and POST with
// ON CONFLICT DO NOTHING is just as safe to repeat. A malformed id becomes 404 in errorHandler.

// Mounted at /api/listings/:id/save. mergeParams lets it read the listing's :id.
export const listingSaveRouter = Router({ mergeParams: true });
listingSaveRouter.use(requireAuth);

// Mounted at /api/users/me/saved.
export const mySavedRouter = Router();
mySavedRouter.use(requireAuth);

// POST /api/listings/:id/save -> { saved: true }. 200, not 201: saving again creates nothing.
// The rules live in db/saved.js, which the Telegram bot's Save button uses too.
listingSaveRouter.post("/", async (req, res) => {
  const result = await saveListing(req.userId, req.params.id);
  if (result === "not_found") throw new HttpError(404, "Listing not found.");
  if (result === "own") throw new HttpError(400, "You cannot save your own listing.");
  res.json({ saved: true });
});

// DELETE /api/listings/:id/save -> 204, also if it was not saved
listingSaveRouter.delete("/", async (req, res) => {
  await unsaveListing(req.userId, req.params.id);
  res.status(204).end();
});

// GET /api/users/me/saved -> my saved listings, most recently saved first, in any status
mySavedRouter.get("/", async (req, res) => {
  const { rows } = await query(
    `${LISTING_SELECT}
     JOIN saved_listings s ON s.listing_id = l.id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
    [req.userId],
  );
  res.json({ listings: rows.map(toListing) });
});

// GET /api/users/me/saved/ids -> { listingIds }: lets a page fill in the hearts on the cards it shows
mySavedRouter.get("/ids", async (req, res) => {
  const { rows } = await query("SELECT listing_id FROM saved_listings WHERE user_id = $1", [req.userId]);
  res.json({ listingIds: rows.map((row) => row.listing_id) });
});
