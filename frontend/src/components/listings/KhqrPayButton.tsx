"use client";

import { QrCode } from "lucide-react";
import { useState } from "react";
import { KhqrCode } from "@/components/listings/KhqrCode";
import { Button } from "@/components/ui/button";
import { useKhqrStatus } from "@/hooks/use-khqr-status";
import { startKhqrPayment } from "@/lib/api/actions";
import type { KhqrPayment, KhqrStatus } from "@/types";

/** What to tell the buyer once the QR is off the screen. */
const STATUS_NOTES: Partial<Record<KhqrStatus, string>> = {
  expired:
    "This QR has expired. If you paid it before then, do not pay again: UniSwap keeps checking with Bakong and will let you know.",
  unavailable: "This item has just been sold, so its QR was withdrawn. Do not pay it.",
  paid: "Payment received. Loading...",
  refund_due: "Payment received. Loading...",
};

interface KhqrPayButtonProps {
  listingId: string;
  /** Already formatted, e.g. "$550". */
  priceLabel: string;
  sellerName: string;
}

/**
 * "Pay with KHQR": shows a QR that pays the seller's own Bakong account, and keeps asking the API
 * (which asks Bakong) whether it was paid. Real money: there is no test mode.
 */
export function KhqrPayButton({ listingId, priceLabel, sellerName }: KhqrPayButtonProps) {
  const [payment, setPayment] = useState<KhqrPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const { status, isFailing } = useKhqrStatus(listingId, payment);
  const canStart = payment === null || status === "expired";

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
  }

  return (
    <div className="flex flex-col gap-1.5">
      {payment && status === "pending" ? (
        <KhqrCode payment={payment} sellerName={sellerName} isFailing={isFailing} />
      ) : null}
      {canStart ? (
        <Button onClick={handleClick} disabled={isBusy} size="lg">
          <QrCode aria-hidden="true" />
          {isBusy ? "Creating QR..." : status === "expired" ? "Make a new QR" : `Pay ${priceLabel} with KHQR`}
        </Button>
      ) : null}
      <p role="status" className="text-xs text-muted-foreground">
        {(payment ? STATUS_NOTES[status] : null) ?? "Real money, paid straight to the seller. UniSwap never holds it."}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
