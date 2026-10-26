"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { FilterSelect } from "@/components/listings/FilterSelect";
import { FilterToggle } from "@/components/listings/FilterToggle";
import { Button } from "@/components/ui/button";
import { CATEGORIES, CONDITIONS, LISTING_TYPES, PRICE_MAX } from "@/lib/constants";
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
  {
    key: "minPrice",
    label: "Min price",
    options: [
      { value: ANY, label: "No minimum" },
      { value: "10", label: "$10 or more" },
      { value: "50", label: "$50 or more" },
      { value: "100", label: "$100 or more" },
    ],
  },
  {
    key: "maxPrice",
    label: "Max price",
    options: [
      { value: ANY, label: "Any price" },
      { value: String(PRICE_MAX / 2), label: `Under $${PRICE_MAX / 2}` },
      { value: String(PRICE_MAX), label: `Under $${PRICE_MAX}` },
    ],
  },
];

/**
 * Browse filters. State is written back to the URL so the current filter set is
 * shareable and survives a refresh; the server page reads it via `searchParams`.
 * The navbar's search term (`q`) is kept when a filter changes.
 * On phones the panel starts folded behind a "Filters" button, because five stacked
 * dropdowns pushed the first listing far down the screen.
 */
export function FilterPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const readUrl = () =>
    Object.fromEntries(FILTERS.map(({ key }) => [key, searchParams.get(key) ?? ANY]));
  const [values, setValues] = useState<Record<string, string>>(readUrl);
  // Phones only: the panel stays open after a filter is picked, since the page keeps it mounted.
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

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
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const activeCount = Object.values(values).filter((value) => value !== ANY).length;

  return (
    <div className="flex flex-col gap-3">
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

        <Button
          variant="secondary"
          disabled={activeCount === 0}
          onClick={() => apply(Object.fromEntries(FILTERS.map(({ key }) => [key, ANY])))}
        >
          Clear
        </Button>

        <p className="text-muted-foreground text-xs sm:ml-auto sm:pb-3">Prices in USD</p>
      </section>
    </div>
  );
}
