import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuctionPanel } from "@/components/listings/AuctionPanel";
import { BuyerOfferPanel } from "@/components/listings/BuyerOfferPanel";
import { ListingGallery } from "@/components/listings/ListingGallery";
import { ListingHeading } from "@/components/listings/ListingHeading";
import { ListingMatches } from "@/components/listings/ListingMatches";
import { ListingOwnerActions } from "@/components/listings/ListingOwnerActions";
import { ListingPayButtons } from "@/components/listings/ListingPayButtons";
import { ListingTypeTag } from "@/components/listings/ListingTypeTag";
import { SellerOffersPanel } from "@/components/listings/SellerOffersPanel";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { Badge } from "@/components/ui/badge";
import {
  confirmPayment,
  conversationId,
  getBids,
  getCurrentUser,
  getKhqrStatus,
  getListingById,
  getMyOffer,
  getPaymentOptions,
  paymentBannerStatus,
} from "@/lib/api";
import { CATEGORIES, conditionLabel, listingTypeLabel, statusLabel } from "@/lib/constants";
import { formatRelativeTime, payableAmount } from "@/lib/utils";

/** What a buyer sees after returning from a payment, by its status. */
const PAYMENT_BANNERS = {
  paid: "Payment received. The item is yours: message the seller to arrange the handover.",
  pending: "Your payment is still processing. Refresh this page in a moment.",
  refund_due:
    "Your payment went through, but the item had already been sold or reserved for another buyer. The seller has been asked to refund you: message them if you have not heard back.",
  unconfirmed: "We could not check your payment just now. Do not pay again: refresh this page in a moment.",
} as const;

/** Detail view for a single listing. */
export default async function ListingDetailPage({ params, searchParams }: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const { session_id: sessionId, khqr: khqrPaymentId } = await searchParams;
  const user = await getCurrentUser();
  // Back from Stripe (?session_id=) or from a paid KHQR (?khqr=): confirm with the API first, so the
  // listing below already shows as sold. The API checks with Stripe or Bakong, never trusting the URL.
  const payment = !user ? null
    : typeof sessionId === "string" ? await paymentBannerStatus(confirmPayment(sessionId))
    : typeof khqrPaymentId === "string" ? await paymentBannerStatus(getKhqrStatus(khqrPaymentId))
    : null;
  const [listing, paymentOptions] = await Promise.all([getListingById(id), getPaymentOptions()]);

  if (!listing) notFound();
  const bids = listing.auction ? await getBids(listing.id) : [];

  const category = CATEGORIES.find((item) => item.value === listing.category);
  const isOwner = user?.id === listing.seller.id;
  // Offers are for items for sale. Your accepted offer reserves the item for you at that price.
  const canOffer = user !== null && !isOwner && listing.listingType === "sale";
  const myOffer = canOffer ? await getMyOffer(listing.id) : null;
  // Mirrors the API's rule (backend/src/utils/payments.js). Null when this viewer cannot pay online.
  const payAmount = payableAmount(listing, user?.id ?? null, myOffer);
  // A wanted post's owner is looking to buy, so the contact button names them instead of "seller".
  const contactName = listing.listingType === "buy_request" ? listing.seller.name : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to browse
      </Link>

      {payment && payment in PAYMENT_BANNERS ? (
        <p role="status" className="light-surface rounded-xl border border-border bg-card p-3 text-sm font-medium text-foreground">
          {PAYMENT_BANNERS[payment as keyof typeof PAYMENT_BANNERS]}
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <ListingGallery imageUrls={listing.imageUrls} title={listing.title} />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* The same tag as on the cards; sale has none, so it keeps the plain "For sale" badge. */}
              {listing.listingType === "sale" ? (
                <Badge>{listingTypeLabel(listing.listingType)}</Badge>
              ) : (
                <ListingTypeTag type={listing.listingType} />
              )}
              {category ? <Badge variant="secondary">{category.label}</Badge> : null}
              <Badge variant="outline">{conditionLabel(listing.condition)}</Badge>
              {listing.status !== "active" ? (
                <Badge variant={listing.status === "reserved" ? "default" : "outline"}>
                  {statusLabel(listing.status)}
                </Badge>
              ) : null}
            </div>
            <ListingHeading listing={listing} myOffer={myOffer} />
          </div>

          <p className="leading-relaxed text-foreground">{listing.description}</p>

          {listing.auction ? (
            <AuctionPanel listing={{ ...listing, auction: listing.auction }} bids={bids} userId={user?.id ?? null} />
          ) : null}

          {canOffer ? <BuyerOfferPanel listing={listing} offer={myOffer} /> : null}
          {payAmount !== null ? (
            <ListingPayButtons listing={listing} amount={payAmount} options={paymentOptions} />
          ) : null}

          {isOwner && listing.listingType === "sale" ? <SellerOffersPanel listing={listing} /> : null}
          {isOwner ? (
            <ListingOwnerActions
              listingId={listing.id}
              listingType={listing.listingType}
              status={listing.status}
            />
          ) : (
            // Signed-out visitors are sent to sign in first; the thread page needs a session.
            <Link
              href={user ? `/messages/${conversationId(listing.id, listing.seller.id)}` : "/login"}
              className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary/85"
            >
              {user ? `Message ${contactName ?? "seller"}` : `Sign in to message ${contactName ?? "the seller"}`}
            </Link>
          )}

          <div className="light-surface rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <UserAvatar name={listing.seller.name} src={listing.seller.avatarUrl} />
              <div className="flex flex-col">
                <Link
                  href={`/profile/${listing.seller.id}`}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  {listing.seller.name}
                  <VerifiedBadge isVerified={listing.seller.isVerified} />
                </Link>
                <p className="text-xs text-muted-foreground">Posted {formatRelativeTime(listing.createdAt)}</p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin aria-hidden="true" className="size-4" />
              Meet on campus. Exchange items in person.
            </p>
          </div>
        </div>
      </div>
      {isOwner ? <Suspense fallback={null}><ListingMatches listing={listing} /></Suspense> : null}
    </div>
  );
}

