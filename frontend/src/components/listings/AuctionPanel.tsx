import { Gavel } from "lucide-react";
import Link from "next/link";
import { BidForm } from "@/components/listings/BidForm";
import { BidHistory } from "@/components/listings/BidHistory";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import type { AuctionInfo, Bid, ListingWithSeller } from "@/types";

interface AuctionPanelProps {
  listing: ListingWithSeller & { auction: AuctionInfo };
  bids: Bid[];
  /** The signed-in user's id, or null when signed out. */
  userId: string | null;
}

/** Bidding box on an auction's detail page: current bid, time left, the bid form, recent bids. */
export function AuctionPanel({ listing, bids, userId }: AuctionPanelProps) {
  const { auction } = listing;
  const isClosed = auction.ended || listing.status !== "active";
  const isLeader = userId !== null && userId === auction.leadingBidderId;
  const minimumBid = auction.highestBid === null ? listing.price : auction.highestBid + auction.minIncrement;
  const statusLine = standing(isClosed, isLeader, auction.bidCount > 0);

  return (
    // id="bid" is where the phone buy bar's "Place bid" scrolls to; scroll-mt-20 keeps the
    // panel's top clear of the sticky navbar.
    <section id="bid" aria-label="Auction" className="light-surface scroll-mt-20 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-foreground">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <Gavel aria-hidden="true" className="size-4" />
          Auction
        </h2>
        <p className="text-sm text-muted-foreground">
          {isClosed ? "Bidding closed" : `Ends ${formatRelativeTime(auction.endsAt)}`}
        </p>
      </header>

      <p className="text-sm">
        {auction.highestBid === null ? "Starting bid" : "Highest bid"}{" "}
        <span className="font-semibold">{formatPrice(auction.highestBid ?? listing.price)}</span>
        {" · "}
        {auction.bidCount} {auction.bidCount === 1 ? "bid" : "bids"} · raise by at least{" "}
        {formatPrice(auction.minIncrement)}
      </p>

      {statusLine ? <p className="text-sm font-medium">{statusLine}</p> : null}

      {isClosed || isLeader ? null : !userId ? (
        <Link href="/login" className="text-sm font-medium underline">
          Sign in to bid
        </Link>
      ) : userId === listing.seller.id ? (
        <p className="text-sm text-muted-foreground">You can&apos;t bid on your own auction.</p>
      ) : (
        <BidForm listingId={listing.id} minimumBid={minimumBid} />
      )}

      <BidHistory bids={bids} />
    </section>
  );
}

/** Where the viewer stands, in one line. Nothing to say while someone else leads. */
function standing(isClosed: boolean, isLeader: boolean, hasBids: boolean): string | null {
  if (isClosed && isLeader) return "You won! Message the seller to arrange the handover.";
  if (isClosed) return hasBids ? "The highest bidder won this auction." : "Ended with no bids.";
  if (isLeader) return "You have the highest bid.";
  return null;
}
