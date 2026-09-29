import {
  CURRENT_USER_ID,
  mockConversations,
  mockListings,
  mockMessages,
  mockUsers,
} from "@/lib/mock/data";
import type {
  Conversation,
  Listing,
  ListingFilters,
  ListingWithSeller,
  Message,
  User,
} from "@/types";

/**
 * Mock API surface. Every function is async and resolves from in-memory data,
 * so pages can be written exactly as they will be written against a real API.
 * The small delay keeps loading states honest during development.
 */

const LATENCY_MS = 150;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

function findUser(id: string): User {
  const user = mockUsers.find((item) => item.id === id);
  if (!user) throw new Error(`Unknown user: ${id}`);
  return user;
}

function withSeller(listing: Listing): ListingWithSeller {
  const seller = findUser(listing.sellerId);
  return {
    ...listing,
    seller: {
      id: seller.id,
      name: seller.name,
      avatarUrl: seller.avatarUrl,
      isVerified: seller.isVerified,
    },
  };
}

/** Apply the browse filters. Kept as a pure function so it is easy to unit test. */
function matchesFilters(listing: Listing, filters: ListingFilters): boolean {
  if (filters.query) {
    const haystack = `${listing.title} ${listing.description}`.toLowerCase();
    if (!haystack.includes(filters.query.toLowerCase())) return false;
  }
  if (filters.category && filters.category !== "all" && listing.category !== filters.category) {
    return false;
  }
  if (filters.condition && filters.condition !== "all" && listing.condition !== filters.condition) {
    return false;
  }
  if (filters.minPrice !== undefined && listing.price < filters.minPrice) return false;
  if (filters.maxPrice !== undefined && listing.price > filters.maxPrice) return false;
  return true;
}

export async function getListings(filters: ListingFilters = {}): Promise<ListingWithSeller[]> {
  const result = mockListings
    .filter((listing) => listing.status === "active" || filters.category === undefined)
    .filter((listing) => matchesFilters(listing, filters))
    .map(withSeller);
  return delay(result);
}

export async function getListingById(id: string): Promise<ListingWithSeller | null> {
  const listing = mockListings.find((item) => item.id === id);
  return delay(listing ? withSeller(listing) : null);
}

/** All listings posted by one seller, in any status. Used by the profile pages. */
export async function getListingsBySeller(sellerId: string): Promise<ListingWithSeller[]> {
  return delay(mockListings.filter((listing) => listing.sellerId === sellerId).map(withSeller));
}

/** Listings belonging to the signed-in user. */
export async function getMyListings(sellerId = CURRENT_USER_ID): Promise<ListingWithSeller[]> {
  return getListingsBySeller(sellerId);
}

export async function getUserById(id: string): Promise<User | null> {
  return delay(mockUsers.find((item) => item.id === id) ?? null);
}

export async function getConversations(userId = CURRENT_USER_ID): Promise<Conversation[]> {
  return delay(mockConversations.filter((item) => item.participantIds.includes(userId)));
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return delay(
    mockMessages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

/** The other participant in a conversation, given the signed-in user. */
export function getConversationPartner(
  conversation: Conversation,
  userId = CURRENT_USER_ID,
): User | null {
  const partnerId = conversation.participantIds.find((id) => id !== userId);
  if (!partnerId) return null;
  return mockUsers.find((item) => item.id === partnerId) ?? null;
}

