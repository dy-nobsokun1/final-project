import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, type CSSProperties, Suspense } from "react";
import { AuctionPanel } from "@/components/listings/AuctionPanel";
import { BuyerOfferPanel } from "@/components/listings/BuyerOfferPanel";
import { ListingBuyBar } from "@/components/listings/ListingBuyBar";
import { InvoiceReceiptCard } from "@/components/listings/InvoiceReceiptCard";
import { ListingFacts } from "@/components/listings/ListingFacts";
import { ListingGallery } from "@/components/listings/ListingGallery";
import { ListingGridSkeleton } from "@/components/listings/ListingGridSkeleton";
import { ListingHeading } from "@/components/listings/ListingHeading";
import { ListingMatches } from "@/components/listings/ListingMatches";
import { ListingOwnerActions } from "@/components/listings/ListingOwnerActions";
import { ListingPayButtons } from "@/components/listings/ListingPayButtons";
import { ListingSellerCard } from "@/components/listings/ListingSellerCard";
import { ListingStatusPill } from "@/components/listings/ListingStatusPill";
import { ListingTypeTag } from "@/components/listings/ListingTypeTag";
import { PaymentBanner } from "@/components/listings/PaymentBanner";
import { SellerOffersPanel } from "@/components/listings/SellerOffersPanel";
import { SimilarItems } from "@/components/listings/SimilarItems";
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
  getReceipt,
  paymentBannerStatus,
} from "@/lib/api";
import { listingTypeLabel } from "@/lib/constants";
import { formatListingPrice, payableAmount } from "@/lib/utils";

/**
 * The right column's sections rise in one after another when the page opens (`card-in` in
 * globals.css, 70 ms apart). React keeps the same elements on a refresh or after a bid, so it plays once.
 */
const rise = (index: number) => ({ "--i": index }) as CSSProperties;

/** One API call per page view: the tab title and the page share it (React `cache`). */
const getListing = cache(getListingById);

/** The browser tab shows the listing's title. A missing listing gets a plain title; the page answers 404. */
export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const listing = await getListing((await params).id);
  return { title: listing ? `${listing.title} | UniSwap` : "Listing not found | UniSwap" };
}

/** Detail view for a single listing. */
export default async function ListingDetailPage({ params, searchParams }: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const { session_id: sessionId, khqr: khqrPaymentId, invoice: invoiceParam } = await searchParams;
  const user = await getCurrentUser();
  // Back from Stripe (?session_id=) or from a paid KHQR (?khqr=): confirm with the API first, so the
  // listing below already shows as sold. The API checks with Stripe or Bakong, never trusting the URL.
  const cardResult = user && typeof sessionId === "string" ? await paymentBannerStatus(confirmPayment(sessionId)) : null;
  const payment = !user ? null
    : typeof sessionId === "string" ? (cardResult === "unconfirmed" ? cardResult : cardResult?.status ?? null)
    : typeof khqrPaymentId === "string" ? await paymentBannerStatus(getKhqrStatus(khqrPaymentId))
    : null;
  // For "Paid with Mastercard •••• 4444" under the banner (PaymentBanner).
  const paidCard = cardResult !== "unconfirmed" && cardResult?.status === "paid" ? cardResult.card : undefined;
  const [listing, paymentOptions] = await Promise.all([getListing(id), getPaymentOptions()]);
  // A receipt link (?invoice=) only asks to see it: the card shows if the API says this is your paid deal.
  const wantsReceipt = typeof invoiceParam === "string" && invoiceParam !== "";
  const receipt = user && wantsReceipt && listing ? await getReceipt(listing.id) : null;

  if (!listing) notFound();
  const bids = listing.auction ? await getBids(listing.id) : [];

  const isOwner = user?.id === listing.seller.id;
  // Offers are for items for sale. Your accepted offer reserves the item for you at that price.
  const canOffer = user !== null && !isOwner && listing.listingType === "sale";
  const myOffer = canOffer ? await getMyOffer(listing.id) : null;
  // Mirrors the API's rule (backend/src/utils/payments.js). Null when this viewer cannot pay online.
  const payAmount = payableAmount(listing, user?.id ?? null, myOffer);
  // A wanted post's owner is looking to buy, so the contact button names them instead of "seller".
  const contactName = listing.listingType === "buy_request" ? listing.seller.name : null;
  // Signed-out visitors are sent to sign in first; the thread page needs a session.
  const signInHref = `/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`;
  const contactHref = user ? `/messages/${conversationId(listing.id, listing.seller.id)}` : signInHref;
  const contactLabel = user ? `Message ${contactName ?? "seller"}` : `Sign in to message ${contactName ?? "the seller"}`;
  // The phone bar only offers what can still be done: bidding or a chat about an active listing.
  const showBuyBar = !isOwner && listing.status === "active" && !listing.auction?.ended;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to browse
      </Link>

      {receipt ? <InvoiceReceiptCard receipt={receipt} listing={listing} /> : null}
      {wantsReceipt && !user ? (
        <p className="light-surface rounded-xl border border-border bg-card p-3 text-sm text-foreground">
          <Link href={`${signInHref}${encodeURIComponent("?invoice=1")}`} className="font-medium underline">Sign in</Link> to see the receipt for this payment.
        </p>
      ) : null}

      <PaymentBanner payment={payment} paidCard={paidCard} />

      <div className="grid gap-6 md:grid-cols-2">
        <ListingGallery imageUrls={listing.imageUrls} title={listing.title} />

        <div className="flex flex-col gap-4">
          <div className="card-in flex flex-col gap-2" style={rise(0)}>
            <div className="flex flex-wrap items-center gap-2">
              {/* The same tag as on the cards; sale has none, so it keeps the plain "For sale" badge. */}
              {listing.listingType === "sale" ? (
                <Badge>{listingTypeLabel(listing.listingType)}</Badge>
              ) : (
                <ListingTypeTag type={listing.listingType} />
              )}
              <ListingStatusPill status={listing.status} />
            </div>
            <ListingHeading listing={listing} myOffer={myOffer} />
          </div>

          <div className="card-in" style={rise(1)}>
            <ListingFacts listing={listing} />
          </div>

          <p className="card-in leading-relaxed text-foreground" style={rise(2)}>{listing.description}</p>

          <div className="card-in flex flex-col gap-4" style={rise(3)}>
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
              <Link
                href={contactHref}
                className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary/85"
              >
                {contactLabel}
              </Link>
            )}
          </div>

          <div className="card-in" style={rise(4)}>
            <ListingSellerCard seller={listing.seller} isOwner={isOwner} />
          </div>
        </div>
      </div>
      {isOwner ? <Suspense fallback={null}><ListingMatches listing={listing} /></Suspense> : null}
      <Suspense fallback={<ListingGridSkeleton count={4} />}>
        <SimilarItems listing={listing} />
      </Suspense>
      {showBuyBar ? (
        <ListingBuyBar
          price={formatListingPrice(listing)}
          href={listing.auction ? "#bid" : contactHref}
          label={listing.auction ? "Place bid" : contactLabel}
        />
      ) : null}
    </div>
  );
}

