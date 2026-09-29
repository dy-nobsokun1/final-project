// `cn` is provided by the `cn` package that shadcn/ui installs and configures.
// The helpers below are application-specific and are not part of shadcn.
export { cn } from "cn";

/** Format a price for display. Whole amounts drop the trailing `.00`. */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
];

/** Render an ISO timestamp as "3 hours ago". */
export function formatRelativeTime(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (Math.abs(elapsedMs) >= unitMs) {
      return formatter.format(-Math.round(elapsedMs / unitMs), unit);
    }
  }
  return "just now";
}

/** First letters of a name, for the avatar fallback. */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
