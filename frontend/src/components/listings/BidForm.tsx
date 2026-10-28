"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { placeBid } from "@/lib/api/actions";
import { formatPrice } from "@/lib/utils";

interface BidFormProps {
  listingId: string;
  /** The smallest bid the API will accept right now. */
  minimumBid: number;
}

/** Amount box + "Place bid". The API re-checks every rule; this only gives quick feedback. */
export function BidForm({ listingId, minimumBid }: BidFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(new FormData(event.currentTarget).get("amount"));
    if (!(amount >= minimumBid)) {
      setError(`Bid at least ${formatPrice(minimumBid)}.`);
      return;
    }
    setIsBusy(true);
    setError(null);
    const result = await placeBid(listingId, amount);
    setIsBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          name="amount"
          type="number"
          min={minimumBid}
          step="any"
          inputMode="decimal"
          // `key` resets the box to the new minimum after someone (you or another bidder) bids.
          key={minimumBid}
          defaultValue={minimumBid}
          aria-label="Your bid in USD"
          className="bg-brand-50/40"
        />
        <Button type="submit" disabled={isBusy}>
          {isBusy ? "Bidding..." : "Place bid"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Minimum bid: {formatPrice(minimumBid)}</p>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </form>
  );
}
