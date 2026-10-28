import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkKhqrPayment } from "@/lib/api/actions";
import type { KhqrPayment, KhqrStatus } from "@/types";

/** How long to wait after one check has finished before asking again. */
const CHECK_EVERY_MS = 5000;
/** After this many checks in a row without an answer, the QR screen warns the buyer. */
const FAILURES_BEFORE_WARNING = 3;

/**
 * Asks the API (which asks Bakong) whether `payment` has been paid, until the answer ends it.
 * Checks run one at a time: Next.js sends Server Actions one after another, so starting a new
 * check every 5 seconds regardless would only pile them up behind a slow one.
 * - paid / refund_due: goes to the listing page, which confirms it again and explains the result.
 * - expired / unavailable: stops. Without any answer, the QR's own expiry time still ends it,
 *   since banking apps refuse an expired KHQR. Then nobody knows yet whether it was paid, which
 *   `isUnsure` reports, so the screen does not invite the buyer to pay again.
 */
export function useKhqrStatus(listingId: string, payment: KhqrPayment | null) {
  const router = useRouter();
  // Kept per payment, so a new QR starts again from "pending".
  const [answer, setAnswer] = useState<{
    paymentId: string;
    status: KhqrStatus;
    failures: number;
    isGuess: boolean;
  } | null>(null);

  useEffect(() => {
    if (!payment) return;
    const { paymentId } = payment;
    const expiresAt = Date.parse(payment.expiresAt);
    let failures = 0;
    let isStopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      // null: the API or Bakong did not answer. The call itself can also fail in the browser
      // (network down, or a new deployment), which must not stop the checks either.
      const reply = await checkKhqrPayment(paymentId).catch(() => null);
      if (isStopped) return;
      failures = reply === null ? failures + 1 : 0;
      const status = reply ?? (Date.now() >= expiresAt ? "expired" : "pending");
      setAnswer({ paymentId, status, failures, isGuess: reply === null });
      if (status === "paid" || status === "refund_due") router.replace(`/listings/${listingId}?khqr=${paymentId}`);
      else if (status === "pending") timer = setTimeout(check, CHECK_EVERY_MS);
    }

    timer = setTimeout(check, CHECK_EVERY_MS);
    return () => {
      isStopped = true;
      clearTimeout(timer);
    };
  }, [payment, listingId, router]);

  const current = answer && answer.paymentId === payment?.paymentId ? answer : null;
  return {
    status: current?.status ?? "pending",
    isFailing: (current?.failures ?? 0) >= FAILURES_BEFORE_WARNING,
    isUnsure: current?.status === "expired" && current.isGuess,
  };
}
