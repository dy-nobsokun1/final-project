import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import type { Bid } from "@/types";

/** How many bids to list; the bid count above the list still covers all of them. */
const SHOWN_BIDS = 5;

interface BidHistoryProps {
  bids: Bid[];
}

/** The latest highest bids on an auction, highest first. */
export function BidHistory({ bids }: BidHistoryProps) {
  if (bids.length === 0) {
    return <p className="text-sm text-muted-foreground">No bids yet. Be the first!</p>;
  }

  return (
    <ol className="flex flex-col divide-y divide-border text-sm">
      {bids.slice(0, SHOWN_BIDS).map((bid) => (
        <li key={bid.id} className="flex items-center justify-between gap-2 py-1.5">
          <span className="flex items-center gap-1">
            {bid.bidder.name}
            <VerifiedBadge isVerified={bid.bidder.isVerified} />
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{formatRelativeTime(bid.createdAt)}</span>
            <span className="font-semibold">{formatPrice(bid.amount)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
