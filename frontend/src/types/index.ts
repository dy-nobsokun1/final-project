// Shared domain types for UniSwap.
// Route groups do not appear in these strings; they match the URL the user sees.

export type ListingCategory =
  | "textbooks"
  | "electronics"
  | "furniture"
  | "clothing"
  | "bikes"
  | "other";

export type ListingCondition = "new" | "like_new" | "good" | "fair";

export type ListingStatus = "active" | "reserved" | "sold" | "traded";

/** What the poster wants: sell it, find one (buy request), swap it, give it away, or auction it. */
export type ListingType = "sale" | "buy_request" | "trade" | "giveaway" | "auction";

/** Bidding state of an auction listing. For an auction, `Listing.price` is the starting bid. */
export interface AuctionInfo {
  endsAt: string;
  /** True once `endsAt` has passed; no more bids are accepted. */
  ended: boolean;
  /** Each bid must beat the highest by at least this much. */
  minIncrement: number;
  highestBid: number | null;
  leadingBidderId: string | null;
  bidCount: number;
}

export interface Bid {
  id: string;
  amount: number;
  createdAt: string;
  bidder: { id: string; name: string; isVerified: boolean };
}

export interface User {
  id: string;
  name: string;
  /** Private: the API only includes it on your own account, never on public profiles. */
  email?: string;
  /** Private, like email: where KHQR payments for your items go (e.g. "name@aclb"). Null until added. */
  bakongAccountId?: string | null;
  avatarUrl: string | null;
  major: string;
  graduationYear: number | null;
  bio: string;
  isVerified: boolean;
  createdAt: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  /** Extra cash offered on top of an uneven trade. */
  cashTopup: number | null;
  category: ListingCategory;
  condition: ListingCondition;
  listingType: ListingType;
  /** Up to 6 photo URLs (MAX_LISTING_PHOTOS). The first one is the cover. */
  imageUrls: string[];
  sellerId: string;
  status: ListingStatus;
  createdAt: string;
  /** How many students saved it with the heart. Who saved it is private. */
  saveCount: number;
  /** Only set for auction listings. */
  auction: AuctionInfo | null;
}

export interface Message {
  id: string;
  listingId: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

/**
 * The API does not store conversations: a thread is every message between two users
 * about one listing. `id` is built from those two ids so a thread can have a URL.
 */
export interface Conversation {
  id: string;
  listingId: string;
  partnerId: string;
  participantIds: string[];
  lastMessageAt: string;
  unreadCount: number;
  /** The listing the thread is about. The image is its cover photo, or null when it has none. */
  listingTitle: string;
  listingCategory: ListingCategory;
  listingImageUrl: string | null;
  /** The newest message's text, and whether the signed-in user sent it. */
  lastMessageBody: string;
  lastMessageIsMine: boolean;
}

/**
 * A rating one student gave another after a sale or trade. Only the listing's owner and the
 * person they chatted with can review each other, once per listing (backend/src/routes/reviews.js).
 */
export interface Review {
  id: string;
  listingId: string;
  listingTitle: string;
  revieweeId: string;
  /** 1 to 5 whole stars. */
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: Pick<User, "id" | "name" | "avatarUrl">;
}

/** The reviews a student received, newest first, and their average (null until the first one). */
export interface ReviewSummary {
  reviews: Review[];
  averageRating: number | null;
  reviewCount: number;
}

/** A listing joined with the fields a card needs, so the UI does not re-look-up the seller. */
export interface ListingWithSeller extends Listing {
  /** `acceptsKhqr`: the seller has added a Bakong account, so buyers can pay them by KHQR. */
  seller: Pick<User, "id" | "name" | "avatarUrl" | "isVerified"> & { acceptsKhqr: boolean };
}

/**
 * Where an offer stands. "withdrawn": the buyer took it back or replaced it with a new amount.
 * "cancelled": it was accepted, and then the seller made the item available again.
 */
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn" | "cancelled";

/**
 * A price offer below the asking price on an item for sale. Accepting it reserves the item for that
 * buyer at that price (backend/src/routes/offers.js).
 */
export interface Offer {
  id: string;
  listingId: string;
  amount: number;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
  buyer: Pick<User, "id" | "name" | "avatarUrl" | "isVerified">;
}

/** A KHQR to pay for one listing, valid until `expiresAt`. `qr` is the text the QR code encodes. */
export interface KhqrPayment {
  paymentId: string;
  qr: string;
  amount: number;
  expiresAt: string;
}

/**
 * "refund_due": the payment went through after the item was already sold, or reserved for another
 * buyer, so the seller must refund it.
 * "unavailable": not paid, and the item has been sold or traded another way or reserved for another
 * buyer, the amount this buyer would pay has changed, or the seller changed their Bakong account,
 * so the QR must not be paid.
 */
export type KhqrStatus = "paid" | "pending" | "expired" | "refund_due" | "unavailable";

export interface ListingFilters {
  query?: string;
  listingType?: ListingType | "all";
  category?: ListingCategory | "all";
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition | "all";
}

