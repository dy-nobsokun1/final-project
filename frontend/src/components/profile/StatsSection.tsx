import type { ReactNode } from "react";
import { StatsBarChart } from "@/components/profile/StatsBarChart";
import { StatsRingChart } from "@/components/profile/StatsRingChart";
import type { CategoryCount } from "@/types";

interface StatsSectionProps {
  /** "Selling" or "Buying". */
  title: string;
  /** The key numbers along the top, like the profile header's. */
  figures: Array<{ label: string; value: ReactNode }>;
  barsTitle: string;
  months: Array<{ month: string; amount: number }>;
  ringTitle: string;
  categories: CategoryCount[];
}

/** One side of your stats: its numbers, then money per month (bars) and items per category (ring). */
export function StatsSection({ title, figures, barsTitle, months, ringTitle, categories }: StatsSectionProps) {
  return (
    <section
      aria-label={title}
      className="light-surface flex flex-col gap-5 rounded-3xl border border-border bg-brand-50 p-5 sm:p-6"
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        {figures.map((figure) => (
          <div key={figure.label} className="flex flex-col">
            <dt className="text-xs font-semibold text-muted-foreground">{figure.label}</dt>
            <dd className="font-heading text-2xl tracking-wide">{figure.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-8 md:grid-cols-2">
        <StatsBarChart title={barsTitle} months={months} />
        <StatsRingChart title={ringTitle} categories={categories} />
      </div>
    </section>
  );
}
