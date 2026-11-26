// The data shapes the API sends back. COPIED on 12 Nov 2026 from frontend/src/types/index.ts
// (only the types the app uses). Metro cannot import files from outside mobile/, so keep both the same.

export type ListingCategory = "textbooks" | "electronics" | "furniture" | "clothing" | "bikes" | "other";

export type ListingCondition = "new" | "like_new" | "good" | "fair";

export type ListingStatus = "active" | "reserved" | "sold" | "traded";

/** Sell it, find one (buy request = wanted post), swap it, give it away, or auction it. */
export type ListingType = "sale" | "buy_request" | "trade" | "giveaway" | "auction";

/** Bidding state of an auction listing. For an auction, `Listing.price` is the starting bid. */
export interface AuctionInfo {
  endsAt: string;
  ended: boolean;
  minIncrement: number;
  highestBid: number | null;
  leadingBidderId: string | null;
  bidCount: number;
}

export interface User {
  id: string;
  name: string;
  /** Only on your own account (GET /api/auth/me), never on someone else's. */
  email?: string;
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
  /** Up to 6 photo URLs. The first one is the cover. */
  imageUrls: string[];
  sellerId: string;
  status: ListingStatus;
  createdAt: string;
  saveCount: number;
  auction: AuctionInfo | null;
}

/** A listing with the seller's public details, as every listing route returns it. */
export interface ListingWithSeller extends Listing {
  seller: Pick<User, "id" | "name" | "avatarUrl" | "isVerified">;
}

/** GET /api/users/:id/reviews (the reviews themselves are left out; the app shows only the stars). */
export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
}

/** One chat message (GET/POST /api/messages and the live stream). */
export interface Message {
  id: string;
  listingId: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

/** One row of the inbox (GET /api/messages/conversations): a thread about one listing with one person. */
export interface Conversation {
  listingId: string;
  partnerId: string;
  lastMessageAt: string;
  unreadCount: number;
  listingTitle: string;
  listingCategory: ListingCategory;
  /** The listing's cover photo, or null when it has none. */
  listingImageUrl: string | null;
  lastMessageBody: string;
  lastMessageIsMine: boolean;
}

/** GET /api/users/me/stats: only the totals are used in the app (no charts). */
export interface UserStats {
  deals: number;
  earned: number;
  spent: number;
}

/** GET /api/users/me/purchases: one thing the student bought. */
export interface Purchase {
  listing: ListingWithSeller;
  amount: number;
  at: string | null;
  how: "card" | "khqr" | "auction" | "offer" | "trade" | "free";
  myRating: number | null;
}
