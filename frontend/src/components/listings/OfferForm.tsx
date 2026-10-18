"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { makeOffer } from "@/lib/api/actions";
import { formatPrice } from "@/lib/utils";

interface OfferFormProps {
  listingId: string;
  askingPrice: number;
  /** The buyer's pending offer, which the form then changes, or null for a new offer. */
  currentAmount: number | null;
}

/** Amount box + "Make offer". The API re-checks every rule; this only gives quick feedback. */
export function OfferForm({ listingId, askingPrice, currentAmount }: OfferFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(new FormData(event.currentTarget).get("amount"));
    if (!(amount > 0 && amount < askingPrice)) {
      setError(`Offer more than $0 and less than ${formatPrice(askingPrice)}. At the asking price, just pay for it.`);
      return;
    }
    setIsBusy(true);
    setError(null);
    const result = await makeOffer(listingId, amount);
    setIsBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          name="amount"
          type="number"
          min="0.01"
          step="any"
          inputMode="decimal"
          aria-label="Your offer in USD"
          // `key` resets the box when the pending offer changes (after sending a new amount).
          key={currentAmount ?? "new"}
          defaultValue={currentAmount ?? ""}
          className="bg-brand-50/40"
        />
        <Button type="submit" disabled={isBusy}>
          {isBusy ? "Sending..." : currentAmount === null ? "Make offer" : "Change offer"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Asking {formatPrice(askingPrice)}. If the seller accepts, the item is reserved for you at your price.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </form>
  );
}
