import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuctionPanel } from "@/components/listings/AuctionPanel";
import { ListingImage } from "@/components/listings/ListingImage";
import { KhqrPayButton } from "@/components/listings/KhqrPayButton";
import { ListingOwnerActions } from "@/components/listings/ListingOwnerActions";
import { PayButton } from "@/components/listings/PayButton";
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
  getPaymentOptions,
} from "@/lib/api";
import { CATEGORIES, conditionLabel, listingTypeLabel, statusLabel } from "@/lib/constants";
import { formatListingPrice, formatRelativeTime } from "@/lib/utils";

/** What a buyer sees after returning from a payment, by its status. */
const PAYMENT_BANNERS = {
  paid: "Payment received. The item is yours: message the seller to arrange the handover.",
  pending: "Your payment is still processing. Refresh this page in a moment.",
  refund_due:
    "Your payment went through, but the item had already been sold. The seller has been asked to refund you: message them if you have not heard back.",
} as const;

/** Detail view for a single listing. */
export default async function ListingDetailPage({ params, searchParams }: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const { session_id: sessionId, khqr: khqrPaymentId } = await searchParams;
  const user = await getCurrentUser();
  // Back from Stripe (?session_id=) or from a paid KHQR (?khqr=): confirm with the API first, so the
  // listing below already shows as sold. The API checks with Stripe or Bakong, never trusting the URL.
  const payment = !user ? null
    : typeof sessionId === "string" ? await confirmPayment(sessionId)
    : typeof khqrPaymentId === "string" ? await getKhqrStatus(khqrPaymentId)
    : null;
  const [listing, paymentOptions] = await Promise.all([getListingById(id), getPaymentOptions()]);

  if (!listing) notFound();
  const bids = listing.auction ? await getBids(listing.id) : [];

  const category = CATEGORIES.find((item) => item.value === listing.category);
  const isOwner = user?.id === listing.seller.id;
  // Mirrors the API's rule (backend/src/utils/payments.js): an item for sale, or an auction you won.
  const canPay = user !== null && !isOwner && (
    (listing.listingType === "sale" && listing.status === "active" && listing.price > 0)
    || (listing.auction !== null && listing.status === "reserved" && listing.auction.leadingBidderId === user.id)
  );
  // KHQR also needs the seller to have added a Bakong account, since the money goes straight to them.
  const canPayByKhqr = canPay && paymentOptions.khqr && listing.seller.acceptsKhqr;

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
        <ListingImage
          src={listing.imageUrls[0]}
          alt={listing.title}
          className="aspect-[4/3] w-full rounded-xl border border-border"
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{listingTypeLabel(listing.listingType)}</Badge>
              {category ? <Badge variant="secondary">{category.label}</Badge> : null}
              <Badge variant="outline">{conditionLabel(listing.condition)}</Badge>
              {listing.status !== "active" ? (
                <Badge variant={listing.status === "reserved" ? "default" : "outline"}>
                  {statusLabel(listing.status)}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
            <p className="text-3xl font-semibold">{formatListingPrice(listing)}</p>
          </div>

          <p className="leading-relaxed text-foreground">{listing.description}</p>

          {listing.auction ? (
            <AuctionPanel listing={{ ...listing, auction: listing.auction }} bids={bids} userId={user?.id ?? null} />
          ) : null}

          {canPayByKhqr ? (
            <KhqrPayButton listingId={listing.id} priceLabel={formatListingPrice(listing)} sellerName={listing.seller.name} />
          ) : null}
          {canPay && paymentOptions.card ? (
            <PayButton listingId={listing.id} priceLabel={formatListingPrice(listing)} />
          ) : null}

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
              {user ? "Message seller" : "Sign in to message the seller"}
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
    </div>
  );
}

