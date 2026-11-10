import { statusLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ListingStatus } from "@/types";

/**
 * Brand colours only. Available is the bright green with a dot, Reserved the pale green, and a
 * finished deal (Sold, Traded) the dark warm red the Free tag uses, so it reads as "gone".
 */
const PILL_COLOURS: Record<ListingStatus, string> = {
  active: "bg-brand-400 text-brand-ink",
  reserved: "bg-brand-50 text-brand-ink",
  sold: "bg-brand-danger text-brand-50",
  traded: "bg-brand-danger text-brand-50",
};

/** One clear pill on the listing page saying if the item can still be had. The words come from statusLabel. */
export function ListingStatusPill({ status }: { status: ListingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm ring-1 ring-black/10",
        PILL_COLOURS[status],
      )}
    >
      {status === "active" ? <span aria-hidden="true" className="size-2 rounded-full bg-brand-900" /> : null}
      {statusLabel(status)}
    </span>
  );
}
