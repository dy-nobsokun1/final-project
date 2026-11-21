// The one place that decides whether a listing may be deleted, and deletes it.
// Used by the owner's DELETE /api/listings/:id and the admin's DELETE /api/admin/listings/:id, so both
// follow exactly the same rules. Deleting a listing also deletes its payments, reviews and offers
// (ON DELETE CASCADE in schema.sql), so it is refused (409) once that history matters: the item was
// sold or traded, it has reviews, money was paid for it, or a payment for it may still be confirmed.
// That payment would be lost with no record. It is also refused while an accepted offer reserves the
// item for a buyer. Who may ask (owner or admin) is checked by the route before calling this.
import { HttpError } from "../utils/httpError.js";
import { RECHECK_HOURS } from "./payments.js";
import { withTransaction } from "./pool.js";

/** Deletes listing `id` if the rules above allow it; otherwise throws 404 or 409. */
export async function deleteListingWithRules(id) {
  await withTransaction(async (client) => {
    // The same row lock a buyer takes when they start paying, so nobody can start in between.
    const { rows: [listing] } = await client.query(
      "SELECT status, reserved_for FROM listings WHERE id = $1 FOR UPDATE", [id]);
    if (!listing) throw new HttpError(404, "Listing not found.");
    if (listing.status === "sold" || listing.status === "traded") {
      throw new HttpError(409, "Sold and traded listings stay on your public profile as a record of the deal, so they cannot be deleted.");
    }
    if (listing.reserved_for) {
      throw new HttpError(409, "You accepted an offer, so this item is reserved for that buyer. Make it available again first (they will be told), then delete it.");
    }
    // Also after "Make available again": its reviews must not disappear with it.
    const { rows: reviews } = await client.query("SELECT 1 FROM reviews WHERE listing_id = $1 LIMIT 1", [id]);
    if (reviews.length) throw new HttpError(409, "People have reviewed this deal, so the listing cannot be deleted.");

    // An unconfirmed payment may still be confirmed for RECHECK_HOURS (see server.js). The extra
    // minute makes it unlikely that a check still waiting for Bakong loses its payment to a delete.
    const { rows: payments } = await client.query(
      `SELECT status, ceil(extract(epoch FROM created_at + make_interval(mins => $2) - now()) / 60)::int AS minutes_left
       FROM payments
       WHERE listing_id = $1 AND (status <> 'pending' OR created_at > now() - make_interval(mins => $2))`,
      [id, RECHECK_HOURS * 60 + 1],
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

    await client.query("DELETE FROM listings WHERE id = $1", [id]);
  });
}
