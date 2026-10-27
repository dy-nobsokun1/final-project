"use client";

import { CreditCard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { startCheckout } from "@/lib/api/actions";

interface PayButtonProps {
  listingId: string;
  /** Already formatted, e.g. "$550". */
  priceLabel: string;
}

/**
 * "Pay with card": asks the API for a Stripe Checkout page and sends the buyer there.
 * Stripe hosts the card form, so card numbers never pass through UniSwap. Test mode only.
 */
export function PayButton({ listingId, priceLabel }: PayButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleClick() {
    setIsBusy(true);
    setError(null);
    const result = await startCheckout(listingId);
    if (result.url) {
      window.location.assign(result.url);
      return;
    }
    setIsBusy(false);
    setError(result.error ?? "Could not start the payment.");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button onClick={handleClick} disabled={isBusy} size="lg">
        <CreditCard aria-hidden="true" />
        {isBusy ? "Opening checkout..." : `Pay ${priceLabel} with card`}
      </Button>
      <p className="text-xs text-muted-foreground">
        Secure checkout by Stripe. Demo mode: no real money is charged.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
