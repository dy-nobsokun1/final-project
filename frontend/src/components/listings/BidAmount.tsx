"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";

/**
 * The auction's current bid. When it changes on this page (a new bid, then refresh()), the amount
 * pulses once (`bid-flash` in globals.css). It does not pulse on page load: it remembers the first
 * amount it showed and pulses only for a different one. The key remounts it for each new amount.
 */
export function BidAmount({ amount }: { amount: number }) {
  const [firstAmount] = useState(amount);
  return (
    <span key={amount} className={amount === firstAmount ? "inline-block font-semibold" : "bid-flash inline-block font-semibold"}>
      {formatPrice(amount)}
    </span>
  );
}
