import { query } from "./pool.js";

// Saving a listing (the heart). The website (routes/saved.js) and the Telegram bot
// (utils/telegramBot.js) both call these, so they follow the same rules.

/**
 * Saves a listing for a student. Returns "saved" (also when it was saved already), "not_found", or
 * "own": nobody can save their own listing.
 */
export async function saveListing(userId, listingId) {
  const { rows: [listing] } = await query("SELECT user_id FROM listings WHERE id = $1", [listingId]);
  if (!listing) return "not_found";
  if (listing.user_id === userId) return "own";
  // ON CONFLICT keeps the first save (and its time). INSERT ... SELECT inserts nothing, instead of
  // a foreign-key error, if the listing was deleted a moment ago.
  await query(
    `INSERT INTO saved_listings (user_id, listing_id)
     SELECT $1, id FROM listings WHERE id = $2
     ON CONFLICT (user_id, listing_id) DO NOTHING`,
    [userId, listingId],
  );
  return "saved";
}

/** Removes a listing from a student's saved ones. Nothing happens if it was not saved. */
export async function unsaveListing(userId, listingId) {
  await query("DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2", [userId, listingId]);
}
