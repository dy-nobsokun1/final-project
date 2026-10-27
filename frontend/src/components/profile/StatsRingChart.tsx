import { categoryLabel } from "@/lib/constants";
import type { CategoryCount } from "@/types";

interface StatsRingChartProps {
  title: string;
  /** Most first, as the API sends them. */
  categories: CategoryCount[];
}

// Six clearly different hues, each with at least 3:1 contrast on the light card (brand-600 is the
// lightest), biggest category first. The ring is drawn clockwise from the top in the legend's order.
// The last slice touches the first, so maroon goes last: it looks like dark green to red-green
// colour-blind eyes, and this way the two meet only when all six show. Blue and plum are kept apart
// for the same reason.
const COLORS = [
  "var(--color-brand-900)", // dark green
  "var(--color-brand-600)", // sage
  "var(--chart-blue)",
  "var(--chart-amber)",
  "var(--chart-plum)",
  "var(--color-brand-danger)", // maroon
];
// A thin gap of card colour between slices, so two dark slices never run into each other.
const GAP_DEGREES = 2;

/** The ring's CSS: one coloured slice per category, each followed by its gap. */
function ringGradient(categories: CategoryCount[], total: number) {
  const gap = categories.length > 1 ? GAP_DEGREES : 0;
  const slices = [];
  let start = 0;
  for (const [index, item] of categories.entries()) {
    const end = start + (item.count / total) * 360;
    slices.push(`${COLORS[index % COLORS.length]} ${start}deg ${end - gap}deg, transparent ${end - gap}deg ${end}deg`);
    start = end;
  }
  return `conic-gradient(${slices.join(", ")})`;
}

/** Counts per category as a ring (a CSS conic-gradient) with a legend that carries every number. */
export function StatsRingChart({ title, categories }: StatsRingChartProps) {
  const total = categories.reduce((sum, item) => sum + item.count, 0);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <div className="flex flex-wrap items-center gap-5">
        {/* The legend beside it says everything the ring shows, so the ring itself is hidden from screen readers. */}
        <div
          aria-hidden="true"
          className="relative size-32 shrink-0 rounded-full"
          style={{ background: ringGradient(categories, total) }}
        >
          <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-brand-50">
            <span className="font-heading text-2xl leading-none">{total}</span>
            <span className="text-xs text-muted-foreground">{total === 1 ? "item" : "items"}</span>
          </div>
        </div>
        <ul className="flex min-w-40 max-w-72 flex-1 flex-col gap-1.5 text-sm">
          {categories.map((item, index) => (
            <li key={item.category} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-sm"
                style={{ background: COLORS[index % COLORS.length] }}
              />
              <span className="flex-1">{categoryLabel(item.category)}</span>
              <span className="font-semibold tabular-nums">
                {item.count} ({Math.round((item.count / total) * 100)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
