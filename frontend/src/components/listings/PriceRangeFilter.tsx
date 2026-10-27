"use client";

import { Fragment, useId, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

/** A price of 0 or more with up to 2 decimals, e.g. "5", "12.5" or "0.99". */
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

const BOXES = [
  { key: "min", label: "Minimum price in US dollars", placeholder: "Min" },
  { key: "max", label: "Maximum price in US dollars", placeholder: "Max" },
] as const;

interface PriceRangeFilterProps {
  /** The applied limits, as in the URL; "" means no limit. */
  min: string;
  max: string;
  onApply: (min: string, max: string) => void;
}

/**
 * Min and max price boxes for the browse filters. They apply on Enter, or when focus leaves both
 * boxes, not on every keystroke, because each change loads new results. They are text boxes with a
 * decimal keypad rather than `type="number"`, so the mouse wheel can't change a price by accident.
 */
export function PriceRangeFilter({ min, max, onApply }: PriceRangeFilterProps) {
  const labelId = useId();
  const [draft, setDraft] = useState({ min, max });

  // Clear, the category tiles and Back change the applied limits, so show them. The same
  // "adjust state when a prop changes" pattern as FilterPanel.
  const [seen, setSeen] = useState({ min, max });
  if (seen.min !== min || seen.max !== max) {
    setSeen({ min, max });
    setDraft({ min, max });
  }

  const applyDraft = () => {
    // An empty box is no limit; anything that isn't a price goes back to the applied one.
    const clean = (text: string, applied: string) =>
      text.trim() === "" ? "" : PRICE_PATTERN.test(text.trim()) ? String(Number(text)) : applied;
    let next = { min: clean(draft.min, min), max: clean(draft.max, max) };
    if (next.min !== "" && next.max !== "" && Number(next.min) > Number(next.max)) {
      next = { min: next.max, max: next.min };
    }
    setDraft(next);
    if (next.min !== min || next.max !== max) onApply(next.min, next.max);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") applyDraft();
  };
  // Going from Min to Max is still typing the same range, so only leaving both boxes applies it.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) applyDraft();
  };

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5" onBlur={onBlur}>
      {/* Styled like FilterSelect's labels, so the row reads as one set. */}
      <span id={labelId} className="text-center text-sm font-bold uppercase tracking-wide text-brand-deep">
        Price
      </span>
      <div className="flex items-center gap-1.5">
        {BOXES.map(({ key, label, placeholder }, index) => (
          <Fragment key={key}>
            {index > 0 ? <span aria-hidden="true" className="text-brand-deep">–</span> : null}
            <div className="relative flex-1 sm:w-24 sm:flex-none">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-brand-deep">
                $
              </span>
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-label={label}
                placeholder={placeholder}
                value={draft[key]}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                onKeyDown={onKeyDown}
                // On the #B1D3B9 card: border 3.2:1 (inputs need 3:1), text 11.72:1, placeholder 4.84:1.
                className="border-brand-deep/60 bg-brand-50 pl-6 text-brand-deep placeholder:text-brand-deep/70"
              />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
