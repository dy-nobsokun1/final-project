import { formatPrice } from "@/lib/utils";

interface StatsBarChartProps {
  title: string;
  /** Oldest first. `month` is "YYYY-MM"; `amount` is dollars. */
  months: Array<{ month: string; amount: number }>;
}

// The tallest bar's height. The chart is taller, to leave room for the amount printed above it.
const BAR_MAX_PX = 112;

/** "2026-10" as "Oct" (short) or "October 2026" (for screen readers). */
function monthName(month: string, style: "short" | "long") {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString("en-US", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/**
 * Money per month as plain div bars, each with its amount printed above it and its month below.
 * Screen readers get the same numbers as a table instead of the drawing.
 */
export function StatsBarChart({ title, months }: StatsBarChartProps) {
  const max = Math.max(...months.map((month) => month.amount));

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <div aria-hidden="true" className="flex h-36 items-end gap-2 border-b border-brand-ink/60">
        {months.map(({ month, amount }) => (
          <div key={month} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold tabular-nums">{formatPrice(amount)}</span>
            <div
              className="w-full max-w-12 rounded-t-md bg-brand-900"
              style={{ height: max > 0 ? Math.round((amount / max) * BAR_MAX_PX) : 0 }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-2">
        {months.map(({ month }) => (
          <span key={month} className="flex-1 text-center text-xs text-muted-foreground">
            {monthName(month, "short")}
          </span>
        ))}
      </div>

      {/* sr-only goes on a wrapper: a table ignores its 1px size and its caption is not clipped, so the
          title showed twice. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <tbody>
            {months.map(({ month, amount }) => (
              <tr key={month}>
                <th scope="row">{monthName(month, "long")}</th>
                <td>{formatPrice(amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
