"use client";

import { QRCodeSVG } from "qrcode.react";
import { formatPrice } from "@/lib/utils";
import type { KhqrPayment } from "@/types";

interface KhqrCodeProps {
  payment: KhqrPayment;
  sellerName: string;
}

/**
 * The KHQR to scan. Always dark on white, in light and dark mode, because some banking apps
 * cannot read a light-on-dark QR code.
 */
export function KhqrCode({ payment, sellerName }: KhqrCodeProps) {
  const expires = new Date(payment.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 text-center text-neutral-900">
      <p className="text-sm font-semibold">Scan with ABA, ACLEDA, Wing or any KHQR app</p>
      <QRCodeSVG value={payment.qr} size={224} marginSize={2} title="KHQR payment code" />
      <p className="text-2xl font-semibold">{formatPrice(payment.amount)}</p>
      <p className="text-sm">Paid straight to {sellerName}&apos;s Bakong account.</p>
      <p role="status" className="text-xs text-neutral-600">
        Waiting for your payment... This code expires at {expires}.
      </p>
    </div>
  );
}
