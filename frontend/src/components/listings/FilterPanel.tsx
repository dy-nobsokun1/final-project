"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FilterSelect } from "@/components/listings/FilterSelect";
import { FilterToggle } from "@/components/listings/FilterToggle";
import { PriceRangeFilter } from "@/components/listings/PriceRangeFilter";
import { Button } from "@/components/ui/button";
import { CATEGORIES, CONDITIONS, LISTING_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ANY = "all";

type Option = { value: string; label: string };
const toOptions = (items: Option[]): Option[] => items.map(({ value, label }) => ({ value, label }));

/** One dropdown per filter. `key` is the URL query param that the browse page reads. */
const FILTERS: Array<{ key: string; label: string; options: Option[] }> = [
  { key: "type", label: "Type", options: [{ value: ANY, label: "Any type" }, ...toOptions(LISTING_TYPES)] },
  {
    key: "category",
    label: "Category",
    options: [{ value: ANY, label: "All categories" }, ...toOptions(CATEGORIES)],
  },
  {
    key: "condition",
    label: "Condition",
    options: [{ value: ANY, label: "Any condition" }, ...toOptions(CONDITIONS)],
  },
];
/** The price boxes' URL params (see PriceRangeFilter). An empty box leaves its param out. */
const PRICE_KEYS = ["minPrice", "maxPrice"];
const URL_KEYS = [...FILTERS.map(({ key }) => key), ...PRICE_KEYS];

/**
 * Browse filters. State is written back to the URL so the current filter set is
 * shareable and survives a refresh; the server page reads it via `searchParams`.
 * The navbar's search term (`q`) is kept when a filter changes.
 * On phones the panel starts folded behind a "Filters" button, because the stacked
 * filters pushed the first listing far down the screen.
 */
export function FilterPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const readUrl = () => Object.fromEntries(URL_KEYS.map((key) => [key, searchParams.get(key) ?? ANY]));
  const [values, setValues] = useState<Record<string, string>>(readUrl);
  // Phones only: the panel stays open after a filter is picked, since the page keeps it mounted.
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  // True from a filter change until the new results are on screen (see the marker below).
  const [isPending, startTransition] = useTransition();

  // Other controls change the URL too (the category tiles, the navbar search), so read it
  // again when it changes. React's "adjust state when a prop changes" pattern, not an effect.
  const query = searchParams.toString();
  const [seenQuery, setSeenQuery] = useState(query);
  if (query !== seenQuery) {
    setSeenQuery(query);
    setValues(readUrl());
  }

  const apply = (next: Record<string, string>) => {
    setValues((current) => ({ ...current, ...next }));
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value !== ANY) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    // Stay put: on phones the grid sits below the hero and the category tiles, so jumping to
    // the top meant scrolling back down after every filter. `push` keeps Back stepping
    // through earlier filter sets.
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const activeCount = Object.values(values).filter((value) => value !== ANY).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Makes the browse page dim its results while they load (see `app/(main)/page.tsx`). */}
      {isPending ? <span data-browse-pending hidden /> : null}
      <FilterToggle count={activeCount} isOpen={isOpen} controls={panelId} onToggle={() => setIsOpen(!isOpen)} />
      <section
        id={panelId}
        aria-label="Filters"
        className={cn(
          "light-surface flex-col gap-4 rounded-xl border bg-card p-4 sm:flex sm:flex-row sm:flex-wrap sm:items-end",
          isOpen ? "flex" : "hidden",
        )}
      >
        {FILTERS.map(({ key, label, options }) => (
          <FilterSelect
            key={key}
            label={label}
            value={values[key]}
            onValueChange={(value) => apply({ [key]: value })}
            options={options}
          />
        ))}
        <PriceRangeFilter
          min={values.minPrice === ANY ? "" : values.minPrice}
          max={values.maxPrice === ANY ? "" : values.maxPrice}
          onApply={(min, max) => apply({ minPrice: min || ANY, maxPrice: max || ANY })}
        />

        <Button
          variant="secondary"
          disabled={activeCount === 0}
          onClick={() => apply(Object.fromEntries(URL_KEYS.map((key) => [key, ANY])))}
        >
          Clear
        </Button>

        <p className="text-muted-foreground text-xs sm:ml-auto sm:pb-3">Prices in USD</p>
      </section>
    </div>
  );
}
