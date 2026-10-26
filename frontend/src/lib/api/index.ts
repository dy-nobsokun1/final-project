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
  Offer,
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

/** Whether the shopping assistant is switched on in the API (it needs GEMINI_API_KEY). */
export async function isAssistantEnabled(): Promise<boolean> {
  const { enabled } = await apiFetch<{ enabled: boolean }>("/api/assistant/config");
  return enabled;
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
export async function confirmPayment(sessionId: string): Promise<"paid" | "pending" | "refund_due" | null> {
  const result = await orNull(
    apiFetch<{ status: "paid" | "pending" | "refund_due" }>("/api/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }),
  );
  return result?.status ?? null;
}

/**
 * For the listing page's banner after paying: the payment's status, or "unconfirmed" when the API
 * could not tell right now (payments switched off, or Stripe or Bakong not answering). The page
 * then still loads, and the buyer is told not to pay again.
 */
export async function paymentBannerStatus<T>(request: Promise<T | null>): Promise<T | "unconfirmed" | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError) return "unconfirmed";
    throw error;
  }
}

/** An auction's bids, highest first. */
export async function getBids(listingId: string): Promise<Bid[]> {
  const result = await orNull(
    apiFetch<{ bids: Bid[] }>(`/api/listings/${encodeURIComponent(listingId)}/bids`),
  );
  return result?.bids ?? [];
}

/**
 * For a wanted post: active items that match it. For any other listing: active wanted posts it
 * matches. Best match first, at most 4 (backend/src/db/matches.js). Empty if the listing is gone.
 */
export async function getListingMatches(listingId: string): Promise<ListingWithSeller[]> {
  const result = await orNull(
    apiFetch<{ listings: ListingWithSeller[] }>(`/api/listings/${encodeURIComponent(listingId)}/matches`),
  );
  return result?.listings ?? [];
}

/** The signed-in user's latest offer on a listing, in any status, or null. */
export async function getMyOffer(listingId: string): Promise<Offer | null> {
  const result = await orNull(
    apiFetch<{ offer: Offer | null }>(`/api/listings/${encodeURIComponent(listingId)}/offers/mine`),
  );
  return result?.offer ?? null;
}

/** The open offers on your own listing, highest first, and the accepted one. Owner only. */
export async function getListingOffers(listingId: string): Promise<Offer[]> {
  const result = await orNull(
    apiFetch<{ offers: Offer[] }>(`/api/listings/${encodeURIComponent(listingId)}/offers`),
  );
  return result?.offers ?? [];
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

/**
 * Ids of the listings the signed-in user saved, so pages can fill in the hearts on their cards.
 * Empty when signed out, and when the API answers with an error: then the hearts show as not saved
 * instead of the whole page failing (e.g. an API that is a version behind), and a click still works.
 */
export async function getSavedListingIds(): Promise<string[]> {
  if (!(await cookies()).has(TOKEN_COOKIE)) return [];
  try {
    return (await apiFetch<{ listingIds: string[] }>("/api/users/me/saved/ids")).listingIds;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // An expired or invalid token (401) just means "signed out", as in getCurrentUser.
    if (error.status !== 401) console.error(`[saved] could not load the saved listing ids (${error.status}): ${error.message}`);
    return [];
  }
}

/** The signed-in user's saved listings, most recently saved first, in any status. */
export async function getSavedListings(): Promise<ListingWithSeller[]> {
  const { listings } = await apiFetch<{ listings: ListingWithSeller[] }>("/api/users/me/saved");
  return listings;
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

/**
 * Whether the signed-in user may review `revieweeId` for this listing. The API decides (it knows
 * who paid or won), so the chat only shows the review form when the review would be accepted.
 */
export async function canReview(listingId: string, revieweeId: string): Promise<boolean> {
  const params = new URLSearchParams({ revieweeId });
  const result = await orNull(
    apiFetch<{ allowed: boolean }>(`/api/listings/${encodeURIComponent(listingId)}/reviews/can-review?${params}`),
  );
  return result?.allowed ?? false;
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
