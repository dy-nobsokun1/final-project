import { SlidersHorizontal } from "lucide-react";

interface FilterToggleProps {
  /** How many filters are set. Shown as a small badge when there are any. */
  count: number;
  isOpen: boolean;
  /** Id of the panel this button shows and hides. */
  controls: string;
  onToggle: () => void;
}

/**
 * Phones only: a "Filters" button that folds the filter panel away, so listings show up sooner.
 * Styled like the hero's light "Sell an item" pill. From `sm` up the panel is always shown.
 */
export function FilterToggle({ count, isOpen, controls, onToggle }: FilterToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={controls}
      onClick={onToggle}
      className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-200 sm:hidden"
    >
      <SlidersHorizontal aria-hidden="true" className="size-4" />
      Filters
      {count > 0 ? (
        <span className="flex size-5 items-center justify-center rounded-full bg-brand-deep text-xs text-brand-50">
          {count}
          <span className="sr-only"> active</span>
        </span>
      ) : null}
    </button>
  );
}
