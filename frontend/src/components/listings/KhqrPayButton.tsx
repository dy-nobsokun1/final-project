"use client";

import { QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KhqrCode } from "@/components/listings/KhqrCode";
import { Button } from "@/components/ui/button";
import { checkKhqrPayment, startKhqrPayment } from "@/lib/api/actions";
import type { KhqrPayment } from "@/types";

/** How often the open QR asks whether Bakong has seen the payment. */
const CHECK_EVERY_MS = 5000;

interface KhqrPayButtonProps {
  listingId: string;
  /** Already formatted, e.g. "$550". */
  priceLabel: string;
  sellerName: string;
}

/**
 * "Pay with KHQR": shows a QR that pays the seller's own Bakong account, then checks every few
 * seconds until the API (which asks Bakong) says it was paid. Real money: there is no test mode.
 */
export function KhqrPayButton({ listingId, priceLabel, sellerName }: KhqrPayButtonProps) {
  const router = useRouter();
  const [payment, setPayment] = useState<KhqrPayment | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!payment || isExpired) return;
    const timer = setInterval(async () => {
      const status = await checkKhqrPayment(payment.paymentId);
      // The listing page confirms the payment again with the API and shows the success message.
      if (status === "paid") router.replace(`/listings/${listingId}?khqr=${payment.paymentId}`);
      if (status === "expired") setIsExpired(true);
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [payment, isExpired, listingId, router]);

  async function handleClick() {
    setIsBusy(true);
    setError(null);
    const result = await startKhqrPayment(listingId);
    setIsBusy(false);
    if (!result.payment) {
      setError(result.error ?? "Could not create the KHQR.");
      return;
    }
    setPayment(result.payment);
    setIsExpired(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {payment && !isExpired ? (
        <KhqrCode payment={payment} sellerName={sellerName} />
      ) : (
        <Button onClick={handleClick} disabled={isBusy} size="lg">
          <QrCode aria-hidden="true" />
          {isBusy ? "Creating QR..." : isExpired ? "QR expired: make a new one" : `Pay ${priceLabel} with KHQR`}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Real money, paid straight to the seller. UniSwap never holds it.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
