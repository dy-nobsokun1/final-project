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

export type ListingStatus = "active" | "sold" | "reserved";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  major: string;
  graduationYear: number;
  bio: string;
  isVerified: boolean;
  createdAt: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: ListingCategory;
  condition: ListingCondition;
  imageUrls: string[];
  sellerId: string;
  status: ListingStatus;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface Conversation {
  id: string;
  listingId: string;
  participantIds: string[];
  lastMessageAt: string;
  unreadCount: number;
}

/** A listing joined with the fields a card needs, so the UI does not re-look-up the seller. */
export interface ListingWithSeller extends Listing {
  seller: Pick<User, "id" | "name" | "avatarUrl" | "isVerified">;
}

export interface ListingFilters {
  query?: string;
  category?: ListingCategory | "all";
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition | "all";
}

