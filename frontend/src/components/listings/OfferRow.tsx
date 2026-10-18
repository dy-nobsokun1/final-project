import Link from "next/link";
import { OfferActionButton } from "@/components/listings/OfferActionButton";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import type { Offer } from "@/types";

/** One pending offer in the seller's Offers box: who offered how much, with Accept and Decline. */
export function OfferRow({ offer }: { offer: Offer }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="flex items-center gap-2">
        <UserAvatar size="sm" name={offer.buyer.name} src={offer.buyer.avatarUrl} />
        <div className="flex flex-col">
          <Link href={`/profile/${offer.buyer.id}`} className="flex items-center gap-1 text-sm font-medium hover:underline">
            {offer.buyer.name}
            <VerifiedBadge isVerified={offer.buyer.isVerified} />
          </Link>
          <p className="text-xs text-muted-foreground">offered {formatRelativeTime(offer.createdAt)}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="py-1 font-semibold">{formatPrice(offer.amount)}</span>
        <OfferActionButton offerId={offer.id} step="accept" />
        <OfferActionButton offerId={offer.id} step="decline" />
      </div>
    </li>
  );
}
