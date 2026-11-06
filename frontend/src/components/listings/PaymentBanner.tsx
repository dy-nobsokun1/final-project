/** What a buyer sees after returning from a payment, by its status. */
const PAYMENT_BANNERS = {
  paid: "Payment received. The item is yours: message the seller to arrange the handover.",
  pending: "Your payment is still processing. Refresh this page in a moment.",
  refund_due:
    "Your payment went through, but the item had already been sold or reserved for another buyer. The seller has been asked to refund you: message them if you have not heard back.",
  unconfirmed: "We could not check your payment just now. Do not pay again: refresh this page in a moment.",
} as const;

interface PaymentBannerProps {
  /** The payment's status from the API (or "unconfirmed"), or null when there is nothing to report. */
  payment: string | null;
  /** For "Paid with Mastercard •••• 4444". Stripe tells the API; nothing is stored. */
  paidCard?: { brand: string; last4: string };
}

/** The line at the top of a listing page after a card or KHQR payment. Nothing for other statuses. */
export function PaymentBanner({ payment, paidCard }: PaymentBannerProps) {
  if (!payment || !(payment in PAYMENT_BANNERS)) return null;
  return (
    <p role="status" className="light-surface rounded-xl border border-border bg-card p-3 text-sm font-medium text-foreground">
      {PAYMENT_BANNERS[payment as keyof typeof PAYMENT_BANNERS]}
      {paidCard ? (
        <span className="mt-1 block font-normal text-muted-foreground">
          Paid with {paidCard.brand} <span aria-hidden="true">••••</span>
          <span className="sr-only">ending in</span> {paidCard.last4}
        </span>
      ) : null}
    </p>
  );
}
