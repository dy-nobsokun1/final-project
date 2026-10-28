"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { acceptOffer, declineOffer, withdrawOffer } from "@/lib/api/actions";

/** What each button says and does. `question` is asked first, for the one step that changes the listing. */
const STEPS = {
  accept: {
    label: "Accept",
    busyLabel: "Accepting...",
    action: acceptOffer,
    variant: "default",
    question: "Accept this offer? The item will be reserved for this buyer at their price, and the other offers will be declined.",
  },
  decline: { label: "Decline", busyLabel: "Declining...", action: declineOffer, variant: "secondary", question: null },
  withdraw: { label: "Withdraw offer", busyLabel: "Withdrawing...", action: withdrawOffer, variant: "secondary", question: null },
} as const;

interface OfferActionButtonProps {
  offerId: string;
  step: keyof typeof STEPS;
}

/** One button that answers an offer: the seller accepts or declines it, the buyer withdraws it. */
export function OfferActionButton({ offerId, step }: OfferActionButtonProps) {
  const { label, busyLabel, action, variant, question } = STEPS[step];
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleClick() {
    if (question && !window.confirm(question)) return;
    setIsBusy(true);
    setError(null);
    const result = await action(offerId);
    setIsBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant={variant} disabled={isBusy} onClick={handleClick}>
        {isBusy ? busyLabel : label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
