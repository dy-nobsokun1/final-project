import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiError, apiFetch, TOKEN_COOKIE } from "@/lib/api/http";
import type {
  Bid,
  Conversation,
  KhqrStatus,
  ListingFilters,
  ListingWithSeller,
  Message,
  Review,
  ReviewSummary,
  User,
} from "@/types";

/**
 * Data reads for Server Components. Each function calls the Express API on the server,
 * sending the login cookie's token, so pages stay plain async Server Components.
 * Changes made from the browser (sign in, post a listing, send a message) live in ./actions.ts.
 */

/** Runs an API request, turning "404 Not Found" into `null` (e.g. a deleted listing). */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * The signed-in user, or null. `cache` makes this one API call per page render,
 * however many layouts and pages ask for it.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!(await cookies()).has(TOKEN_COOKIE)) return null;
  try {
    return (await apiFetch<{ user: User }>("/api/auth/me")).user;
  } catch (error) {
    // An expired or invalid token just means "signed out".
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

/** For pages that only make sense when signed in: sends everyone else to the login page. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function getListings(filters: ListingFilters = {}): Promise<ListingWithSeller[]> {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.listingType && filters.listingType !== "all") params.set("type", filters.listingType);
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.condition && filters.condition !== "all") params.set("condition", filters.condition);
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));

  const { listings } = await apiFetch<{ listings: ListingWithSeller[] }>(`/api/listings?${params}`);
  return listings;
}

/** Which online payments are switched on in the API: card (Stripe test mode) and KHQR (Bakong). */
export async function getPaymentOptions(): Promise<{ card: boolean; khqr: boolean }> {
  const { enabled, khqr } = await apiFetch<{ enabled: boolean; khqr: boolean }>("/api/payments/config");
  return { card: enabled, khqr };
}

/**
 * Whether a KHQR has been paid. The API asks Bakong itself each time, so the browser cannot mark
 * anything paid. Null if the payment is not this user's (or does not exist).
 */
export async function getKhqrStatus(paymentId: string): Promise<KhqrStatus | null> {
  const result = await orNull(
    apiFetch<{ status: KhqrStatus }>(`/api/payments/khqr/${encodeURIComponent(paymentId)}`),
  );
  return result?.status ?? null;
}

/**
 * Called when a buyer returns from Stripe with ?session_id=. The API asks Stripe itself whether
 * the payment went through, so a hand-typed URL cannot mark anything paid.
 */
export async function confirmPayment(sessionId: string): Promise<"paid" | "pending" | null> {
  const result = await orNull(
    apiFetch<{ status: "paid" | "pending" }>("/api/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),
  );
  return result?.status ?? null;
}

/** An auction's bids, highest first. */
export async function getBids(listingId: string): Promise<Bid[]> {
  const result = await orNull(
    apiFetch<{ bids: Bid[] }>(`/api/listings/${encodeURIComponent(listingId)}/bids`),
  );
  return result?.bids ?? [];
}

export async function getListingById(id: string): Promise<ListingWithSeller | null> {
  const result = await orNull(
    apiFetch<{ listing: ListingWithSeller }>(`/api/listings/${encodeURIComponent(id)}`),
  );
  return result?.listing ?? null;
}

/** All listings posted by one seller, in any status. Used by the profile pages. */
export async function getListingsBySeller(sellerId: string): Promise<ListingWithSeller[]> {
  const result = await orNull(
    apiFetch<{ listings: ListingWithSeller[] }>(`/api/users/${encodeURIComponent(sellerId)}/listings`),
  );
  return result?.listings ?? [];
}

/** Listings belonging to the signed-in user. */
export async function getMyListings(): Promise<ListingWithSeller[]> {
  const user = await getCurrentUser();
  return user ? getListingsBySeller(user.id) : [];
}

export async function getUserById(id: string): Promise<User | null> {
  const result = await orNull(apiFetch<{ user: User }>(`/api/users/${encodeURIComponent(id)}`));
  return result?.user ?? null;
}

/** The reviews a student received, newest first, with their average rating. */
export async function getUserReviews(userId: string): Promise<ReviewSummary> {
  const result = await orNull(
    apiFetch<ReviewSummary>(`/api/users/${encodeURIComponent(userId)}/reviews`),
  );
  return result ?? { reviews: [], averageRating: null, reviewCount: 0 };
}

/** The reviews about one listing's deal: at most one per person. */
export async function getListingReviews(listingId: string): Promise<Review[]> {
  const result = await orNull(
    apiFetch<{ reviews: Review[] }>(`/api/listings/${encodeURIComponent(listingId)}/reviews`),
  );
  return result?.reviews ?? [];
}

/** A thread's id in the URL: the listing plus the other person. UUIDs never contain "_". */
export function conversationId(listingId: string, partnerId: string): string {
  return `${listingId}_${partnerId}`;
}

/** The reverse of `conversationId`. Returns null for a malformed id. */
export function parseConversationId(id: string): { listingId: string; partnerId: string } | null {
  const [listingId, partnerId, ...rest] = id.split("_");
  if (!listingId || !partnerId || rest.length > 0) return null;
  return { listingId, partnerId };
}

/** The signed-in user's chat threads, newest first. */
export async function getConversations(): Promise<Conversation[]> {
  const { conversations } = await apiFetch<{ conversations: Omit<Conversation, "id">[] }>(
    "/api/messages/conversations",
  );
  return conversations.map((item) => ({ ...item, id: conversationId(item.listingId, item.partnerId) }));
}

/** One thread between the signed-in user and `partnerId` about a listing, oldest first. */
export async function getMessages(listingId: string, partnerId: string): Promise<Message[]> {
  const params = new URLSearchParams({ listingId, withUserId: partnerId });
  const { messages } = await apiFetch<{ messages: Message[] }>(`/api/messages?${params}`);
  return messages;
}

/** Marks what `partnerId` sent me in this thread as read. Called when the thread is opened. */
export async function markThreadRead(listingId: string, partnerId: string): Promise<void> {
  await apiFetch("/api/messages/read", {
    method: "PATCH",
    body: JSON.stringify({ listingId, withUserId: partnerId }),
  });
}

/** Confirms the token from an email-verification link. False if it is invalid or already used. */
export async function verifyEmail(token: string): Promise<boolean> {
  try {
    await apiFetch("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) return false;
    throw error;
  }
}
