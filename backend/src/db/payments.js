import { HttpError } from "../utils/httpError.js";
import { notifyPaid } from "../utils/notify.js";
import { amountToPay } from "../utils/payments.js";
import { LISTING_SELECT } from "./listings.js";
import { query, withTransaction } from "./pool.js";

// How long a buyer has to pay once they start. Meanwhile, other buyers are told someone is paying.
// Stripe's checkout page and our KHQR codes both expire after this long.
export const PAYMENT_MINUTES = 30;

/**
 * Call inside withTransaction when a buyer starts paying. Locks the listing so two buyers cannot
 * start at the same moment, works out the amount, and refuses (409) if the item is already paid
 * for or someone else is paying right now. Returns { listing, amount }.
 */
export async function lockListingForPayment(client, listingId, buyerId) {
  const locked = await client.query("SELECT id FROM listings WHERE id = $1 FOR UPDATE", [listingId]);
  if (!locked.rows[0]) throw new HttpError(404, "Listing not found.");
  const listing = (await client.query(`${LISTING_SELECT} WHERE l.id = $1`, [listingId])).rows[0];
  const amount = amountToPay(listing, buyerId);

  const { rows: busy } = await client.query(
    `SELECT status FROM payments
     WHERE listing_id = $1 AND (status = 'paid'
       OR (status = 'pending' AND buyer_id <> $2 AND created_at > now() - make_interval(mins => $3)))`,
    [listing.id, buyerId, PAYMENT_MINUTES],
  );
  if (busy.some((row) => row.status === "paid")) throw new HttpError(409, "This item has already been paid for.");
  if (busy.length) {
    throw new HttpError(409, `Someone else is paying for this right now. Try again in ${PAYMENT_MINUTES} minutes.`);
  }
  return { listing, amount };
}

/**
 * Records that a payment went through and marks the listing sold. Safe to call more than once for
 * the same payment (for Stripe, the return page and the webhook may both report it; for KHQR, the
 * QR page and the background check): only the first call changes anything. Returns the payment
 * row the first time, otherwise null.
 */
export async function markPaid(paymentId) {
  const payment = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE payments SET status = 'paid', paid_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING listing_id, buyer_id, amount`,
      [paymentId],
    );
    if (!rows[0]) return null;
    await client.query("UPDATE listings SET status = 'sold', updated_at = now() WHERE id = $1", [rows[0].listing_id]);
    return rows[0];
  });
  if (payment) notifyPaid(payment);
  return payment;
}

/**
 * KHQR payments that may still be paid: started in the last PAYMENT_MINUTES, plus 5 minutes in
 * case Bakong reports a payment made just before its QR expired a little late.
 */
export async function findOpenKhqrPayments() {
  const { rows } = await query(
    `SELECT id, khqr FROM payments
     WHERE method = 'khqr' AND status = 'pending' AND created_at > now() - make_interval(mins => $1)`,
    [PAYMENT_MINUTES + 5],
  );
  return rows;
}
