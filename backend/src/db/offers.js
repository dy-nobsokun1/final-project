import { HttpError } from "../utils/httpError.js";
import { isUuid } from "../utils/validation.js";
import { query } from "./pool.js";

// Price offers on items for sale (routes/offers.js). Every change to an offer first locks its
// listing's row (SELECT ... FOR UPDATE), the same lock a buyer takes to start paying
// (lockListingForPayment). So a new offer, an accept, a decline, a withdrawal, a payment and the
// owner's status change happen one at a time, and each sees what the one before it did.

// An offer with the buyer's public info (never their email), for toOffer in utils/serializers.js.
export const OFFER_SELECT = `
  SELECT o.*, u.name AS buyer_name, u.avatar_url AS buyer_avatar_url, u.is_verified AS buyer_is_verified
  FROM offers o
  JOIN users u ON u.id = o.buyer_id`;

export async function findOfferById(id) {
  const { rows } = await query(`${OFFER_SELECT} WHERE o.id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Call inside withTransaction before changing an offer. Locks the offer's listing and returns
 * { offer, listing }, both read under that lock. 404 if either one does not exist (any more).
 */
export async function lockOffer(client, offerId) {
  if (!isUuid(offerId)) throw new HttpError(404, "Offer not found.");
  const { rows: [found] } = await client.query("SELECT listing_id FROM offers WHERE id = $1", [offerId]);
  if (!found) throw new HttpError(404, "Offer not found.");
  const { rows: [listing] } = await client.query(
    "SELECT id, user_id, listing_type, status, price FROM listings WHERE id = $1 FOR UPDATE",
    [found.listing_id],
  );
  // Read again under the lock: it may have changed, or gone with its listing, while we waited.
  const { rows: [offer] } = await client.query("SELECT * FROM offers WHERE id = $1", [offerId]);
  if (!listing || !offer) throw new HttpError(404, "Offer not found.");
  return { offer, listing };
}

/**
 * Declines every pending offer on a listing, e.g. because the item is no longer available. Call it
 * with the listing locked. Returns the declined offers (listing_id, buyer_id, amount) for
 * notifyOfferDeclined, which the caller sends once the transaction is saved.
 */
export async function declinePendingOffers(client, listingId) {
  const { rows } = await client.query(
    `UPDATE offers SET status = 'declined', updated_at = now()
     WHERE listing_id = $1 AND status = 'pending'
     RETURNING listing_id, buyer_id, amount`,
    [listingId],
  );
  return rows;
}

/**
 * What the owner changing a listing's status (PATCH) does to its offers. `listing` is
 * { id, status, reserved_for }, read under the listing's lock; `nextStatus` is the new status, or
 * undefined if it does not change. Call it BEFORE the listing's own UPDATE: "Make available again"
 * must clear reserved_for first, because schema.sql does not allow an active listing to have one.
 *  - "Make available again" on an item an accepted offer reserved: clears the reservation and
 *    cancels that offer, so the buyer pays the asking price again.
 *  - Leaving "active" (marked reserved, sold or traded): the pending offers are declined.
 *  - "Mark as sold" on an item an offer reserved changes nothing: it went to that buyer in person.
 * Returns { cancelled, declined }: the offers to notify the buyers of, after the transaction is saved.
 */
export async function updateOffersForStatus(client, listing, nextStatus) {
  if (nextStatus === undefined || nextStatus === listing.status) return { cancelled: [], declined: [] };
  if (nextStatus === "active" && listing.reserved_for) {
    await client.query("UPDATE listings SET reserved_for = NULL WHERE id = $1", [listing.id]);
    const { rows: cancelled } = await client.query(
      `UPDATE offers SET status = 'cancelled', updated_at = now()
       WHERE listing_id = $1 AND status = 'accepted'
       RETURNING listing_id, buyer_id, amount`,
      [listing.id],
    );
    return { cancelled, declined: [] };
  }
  if (listing.status === "active") return { cancelled: [], declined: await declinePendingOffers(client, listing.id) };
  return { cancelled: [], declined: [] };
}
