"use client";

import { useEffect, useRef } from "react";
import { Field, FieldInput } from "@/components/forms/Field";

interface AuctionFieldsProps {
  errors: Record<string, string>;
  /** When editing an auction: its current end time (ISO) and minimum raise. */
  endsAt?: string;
  minIncrement?: number;
  valueEndsAt?: string;
  onChangeEndsAt?: (val: string) => void;
  onKeyDownEndsAt?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholderEndsAt?: string;
  valueMinIncrement?: string;
  onChangeMinIncrement?: (val: string) => void;
  onKeyDownMinIncrement?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholderMinIncrement?: string;
}

/**
 * Extra inputs shown on the listing form when the type is "Auction": when bidding closes,
 * and the smallest amount each new bid must add. The form checks and converts them on submit.
 */
export function AuctionFields({
  errors,
  endsAt,
  minIncrement,
  valueEndsAt,
  onChangeEndsAt,
  onKeyDownEndsAt,
  placeholderEndsAt,
  valueMinIncrement,
  onChangeMinIncrement,
  onKeyDownMinIncrement,
  placeholderMinIncrement,
}: AuctionFieldsProps) {
  const endsAtInput = useRef<HTMLInputElement>(null);

  // datetime-local wants the viewer's local time ("2026-10-04T18:00"). The server rendering this
  // page does not know the viewer's time zone, so the current end time is filled in here, in the browser.
  useEffect(() => {
    if (!endsAt || valueEndsAt !== undefined || !endsAtInput.current) return;
    const date = new Date(endsAt);
    endsAtInput.current.value = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }, [endsAt, valueEndsAt]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Auction ends (within 30 days)" error={errors.auctionEndsAt}>
        <FieldInput
          ref={endsAtInput}
          name="auctionEndsAt"
          type="datetime-local"
          value={valueEndsAt}
          onChange={(e) => onChangeEndsAt?.(e.target.value)}
          onKeyDown={onKeyDownEndsAt}
          placeholder={placeholderEndsAt}
          className="bg-brand-50/40 placeholder:text-foreground/45 text-foreground"
        />
      </Field>
      <Field label="Minimum raise (USD)" error={errors.minIncrement}>
        <FieldInput
          name="minIncrement"
          type="number"
          min={0.01}
          step="any"
          value={valueMinIncrement}
          onChange={(e) => onChangeMinIncrement?.(e.target.value)}
          onKeyDown={onKeyDownMinIncrement}
          placeholder={placeholderMinIncrement}
          defaultValue={valueMinIncrement === undefined ? (minIncrement ?? 1) : undefined}
          inputMode="decimal"
          className="bg-brand-50/40 placeholder:text-foreground/45 text-foreground"
        />
      </Field>
    </div>
  );
}
