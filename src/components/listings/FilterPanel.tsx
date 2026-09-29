"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, CONDITIONS, PRICE_MAX } from "@/lib/constants";

const ANY = "all";

const PRICE_PRESETS = [
  { label: "Any price", value: ANY },
  { label: `Under $${PRICE_MAX / 2}`, value: String(PRICE_MAX / 2) },
  { label: `Under $${PRICE_MAX}`, value: String(PRICE_MAX) },
];

/**
 * Browse filters. State is written back to the URL so the current filter set is
 * shareable and survives a refresh; the server page reads it via `searchParams`.
 */
export function FilterPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [category, setCategory] = useState(searchParams.get("category") ?? ANY);
  const [condition, setCondition] = useState(searchParams.get("condition") ?? ANY);
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? ANY);

  const apply = useCallback(
    (next: { category?: string; condition?: string; maxPrice?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value && value !== ANY) params.set(key, value);
        else params.delete(key);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const hasFilters = category !== ANY || condition !== ANY || maxPrice !== ANY;

  return (
    <section
      aria-label="Filters"
      className="light-surface flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
    >
      <FilterSelect
        label="Category"
        value={category}
        onValueChange={(value) => {
          setCategory(value);
          apply({ category: value });
        }}
        options={[
          { value: ANY, label: "All categories" },
          ...CATEGORIES.map((item) => ({ value: item.value, label: item.label })),
        ]}
      />

      <FilterSelect
        label="Condition"
        value={condition}
        onValueChange={(value) => {
          setCondition(value);
          apply({ condition: value });
        }}
        options={[
          { value: ANY, label: "Any condition" },
          ...CONDITIONS.map((item) => ({ value: item.value, label: item.label })),
        ]}
      />

      <FilterSelect
        label="Max price"
        value={maxPrice}
        onValueChange={(value) => {
          setMaxPrice(value);
          apply({ maxPrice: value });
        }}
        options={PRICE_PRESETS}
      />

      <Button
        variant="secondary"
        disabled={!hasFilters}
        onClick={() => {
          setCategory(ANY);
          setCondition(ANY);
          setMaxPrice(ANY);
          apply({ category: ANY, condition: ANY, maxPrice: ANY });
        }}
      >
        Clear
      </Button>

      <p className="text-muted-foreground text-xs sm:ml-auto sm:pb-3">Prices in USD</p>
    </section>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

/** Labelled select, built from shadcn's Radix-based `Select`. */
function FilterSelect({ label, value, onValueChange, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full sm:w-44" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

