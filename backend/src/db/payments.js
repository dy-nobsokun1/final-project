import { isBakongConfigured, isKhqrPaid } from "../services/bakong.js";
import { HttpError } from "../utils/httpError.js";
import { notifyLatePayment, notifyOfferDeclined, notifyPaid } from "../utils/notify.js";
import { amountToPay } from "../utils/payments.js";
import { isUuid } from "../utils/validation.js";
import { LISTING_SELECT } from "./listings.js";
import { declinePendingOffers } from "./offers.js";
import { query, withTransaction } from "./pool.js";

// How long a buyer has to pay once they start. Meanwhile, other buyers are told someone is paying.
// Stripe's checkout page and our KHQR codes both expire after this long.
export const PAYMENT_MINUTES = 30;

// How long the once-a-minute check keeps asking Bakong about a new QR: PAYMENT_MINUTES plus 5 minutes
// in case a payment made just before the QR expired is reported a little late. After that,
// RECHECK_HOURS (below) applies.
export const CONFIRM_MINUTES = PAYMENT_MINUTES + 5;

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
 * row (with its new status) the first time, otherwise null.
 *
 * A payment can arrive after the item is already gone: a KHQR paid just before it expired but
 * reported late, after someone else bought the item, the seller marked it sold, or the seller
 * accepted another buyer's offer, which reserves it for that buyer. The money has really moved, so
 * the payment becomes "refund_due" instead of "paid", the listing is left alone, and both people are
 * told the seller must send the money back.
 */
export async function markPaid(paymentId) {
  const result = await withTransaction(async (client) => {
    const { rows: [pending] } = await client.query(
      "SELECT listing_id, buyer_id FROM payments WHERE id = $1 AND status = 'pending'", [paymentId]);
    if (!pending) return null;
    // Locked, so two payments confirmed at the same moment are handled one after the other:
    // the second one sees the first one's "sold".
    const { rows: [listing] } = await client.query(
      "SELECT status, reserved_for FROM listings WHERE id = $1 FOR UPDATE", [pending.listing_id]);
    if (!listing) return null; // deleted while this call waited for the lock (its payments went with it)
    // Too late if the item already went another way, or the seller accepted another buyer's offer,
    // which reserves it for that buyer only (routes/offers.js).
    const isReservedForOther = listing.reserved_for !== null && listing.reserved_for !== pending.buyer_id;
    const isLate = listing.status === "sold" || listing.status === "traded" || isReservedForOther;

    const { rows } = await client.query(
      `UPDATE payments SET status = $2, paid_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING listing_id, buyer_id, amount, status`,
      [paymentId, isLate ? "refund_due" : "paid"],
    );
    if (!rows[0]) return null; // another call recorded it while this one waited for the lock
    let declinedOffers = [];
    if (!isLate) {
      await client.query("UPDATE listings SET status = 'sold', updated_at = now(), sold_at = now() WHERE id = $1", [rows[0].listing_id]);
      declinedOffers = await declinePendingOffers(client, rows[0].listing_id); // sold: waiting offers can no longer be accepted
    }
    return { payment: rows[0], declinedOffers };
  });

  const payment = result?.payment ?? null;
  if (payment?.status === "refund_due") {
    console.error(`[payments] payment ${paymentId} arrived after listing ${payment.listing_id} was sold or reserved for another buyer: refund due`);
    notifyLatePayment(payment);
  } else if (payment) {
    notifyPaid(payment);
  }
  for (const offer of result?.declinedOffers ?? []) notifyOfferDeclined(offer);
  return payment;
}

// A KHQR still unconfirmed after CONFIRM_MINUTES keeps being checked (less often) for this long, in
// case its confirmation was held up: Bakong down, an expired token, or the API switched off a while.
export const RECHECK_HOURS = 24;

/**
 * KHQR payments still waiting for Bakong: started in the last CONFIRM_MINUTES or, with
 * `includeOlder`, in the last RECHECK_HOURS.
 */
export async function findOpenKhqrPayments({ includeOlder = false } = {}) {
  const { rows } = await query(
    `SELECT id, khqr FROM payments
     WHERE method = 'khqr' AND status = 'pending' AND created_at > now() - make_interval(mins => $1)`,
    [includeOlder ? RECHECK_HOURS * 60 : CONFIRM_MINUTES],
  );
  return rows;
}

/**
 * Asks Bakong about every unconfirmed KHQR for one listing from the last RECHECK_HOURS, and records
 * the ones that were paid. Called before anything that assumes nobody has paid yet: issuing a new QR
 * or card checkout, and the owner marking the item sold. Otherwise a payment whose confirmation was
 * held up (e.g. Bakong was down) could be overtaken by a second sale. Throws if Bakong does not
 * answer. Returns the payments it recorded (each with buyer_id and its new status).
 */
export async function confirmOpenKhqrPayments(listingId) {
  if (!isBakongConfigured || !isUuid(listingId)) return []; // a bad id finds nothing; the caller says 404
  const { rows } = await query(
    `SELECT id, khqr FROM payments
     WHERE listing_id = $1 AND method = 'khqr' AND status = 'pending' AND created_at > now() - make_interval(mins => $2)`,
    [listingId, RECHECK_HOURS * 60],
  );
  const recorded = [];
  for (const payment of rows) {
    if (!(await isKhqrPaid(payment.khqr))) continue;
    const marked = await markPaid(payment.id);
    if (marked) recorded.push(marked);
  }
  return recorded;
}
