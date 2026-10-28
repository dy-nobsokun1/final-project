"use server";

import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { ApiError, apiFetch, TOKEN_COOKIE, VERIFY_EMAIL_COOKIE } from "@/lib/api/http";
import { getKhqrStatus } from "@/lib/api";
import type {
  AssistantAnswer,
  AssistantMessage,
  KhqrPayment,
  KhqrStatus,
  ListingStatus,
  ListingWithSeller,
  User,
} from "@/types";

/**
 * Server Actions: the changes the browser asks for. They run on the Next.js server and forward
 * each request to the Express API with the user's token. The API checks the token and who owns
 * what on every call, so calling an action directly cannot get around those checks.
 */

/** What a form gets back: an error to show, or no error on success. */
export interface ActionResult {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Same lifetime as the API's tokens (7 days). */
const SESSION_SECONDS = 60 * 60 * 24 * 7;

async function saveSession(token: string) {
  (await cookies()).set(TOKEN_COOKIE, token, {
    httpOnly: true, // page scripts cannot read it, so a script injected into the page cannot steal the session
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

/** Same lifetime as a sign-up code (30 minutes). */
const VERIFY_EMAIL_SECONDS = 60 * 30;

async function rememberEmailToVerify(email: string) {
  (await cookies()).set(VERIFY_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VERIFY_EMAIL_SECONDS,
  });
}

/** API errors become messages for the form. Anything else is a bug, so it is logged. */
function toActionError(error: unknown): ActionResult {
  if (error instanceof ApiError) return { error: error.message, fieldErrors: error.details };
  console.error(error);
  return { error: "Something went wrong. Please try again." };
}

/** `needsVerification` is set when the password was right but the email is not verified yet. */
export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult & { user?: User; needsVerification?: boolean }> {
  try {
    const { user, token } = await apiFetch<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await saveSession(token);
    return { user };
  } catch (error) {
    const needsVerification = error instanceof ApiError && error.status === 403;
    return { ...toActionError(error), needsVerification };
  }
}

export async function register(values: {
  name: string;
  email: string;
  password: string;
  major: string;
  graduationYear: number;
}): Promise<ActionResult> {
  try {
    // No session is created here: the account stays locked until the emailed code is entered.
    await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(values) });
    await rememberEmailToVerify(values.email);
    return {};
  } catch (error) {
    return toActionError(error);
  }
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(TOKEN_COOKIE);
}

/** Emails a fresh sign-up code. The password proves the request comes from whoever registered. */
export async function resendVerification(email: string, password: string): Promise<ActionResult> {
  try {
    await apiFetch("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await rememberEmailToVerify(email);
    return {};
  } catch (error) {
    return toActionError(error);
  }
}

/** Asks the API to email a reset link. It answers the same whether or not the account exists. */
export async function requestPasswordReset(email: string): Promise<ActionResult> {
  try {
    await apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    return {};
  } catch (error) {
    return toActionError(error);
  }
}

/** Checks the 6-digit sign-up code. A wrong or expired code comes back as the API's own message. */
export async function verifyEmail(email: string, code: string): Promise<ActionResult & { verified?: boolean }> {
  try {
    await apiFetch("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ email, code }) });
    (await cookies()).delete(VERIFY_EMAIL_COOKIE);
    return { verified: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Sets a new password with the emailed link's token. Creates no session: the person signs in next. */
export async function resetPassword(token: string, password: string): Promise<ActionResult> {
  try {
    await apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
    return {};
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Changes the signed-in user's password. The API signs out every older token, this browser's too,
 * so the fresh one it returns replaces the session cookie. Setting a cookie in a Server Action
 * re-renders the current page, which then reads the new cookie.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ActionResult> {
  try {
    const { token } = await apiFetch<{ token: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    await saveSession(token);
    return {};
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProfile(values: { name: string; bio: string }): Promise<ActionResult & { user?: User }> {
  try {
    const { user } = await apiFetch<{ user: User }>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(values),
    });
    return { user };
  } catch (error) {
    return toActionError(error);
  }
}

/** Saves or removes (null) the Bakong account that KHQR payments for your items go to. */
export async function updateBakongAccount(bakongAccountId: string | null): Promise<ActionResult & { user?: User }> {
  try {
    const { user } = await apiFetch<{ user: User }>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({ bakongAccountId }),
    });
    return { user };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Creates the listing. Returns the new listing's id. The photos were already uploaded one by one as
 * they were picked (uploadListingPhoto), so the form only carries their URLs.
 */
export async function createListing(formData: FormData): Promise<ActionResult & { listingId?: string }> {
  try {
    const { listing } = await apiFetch<{ listing: ListingWithSeller }>("/api/listings", {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        category: formData.get("category"),
        condition: formData.get("condition"),
        listingType: formData.get("listingType"),
        price: Number(formData.get("price") || 0),
        imageUrls: photoUrls(formData),
        // Auctions only. The form has already turned the local date and time into an ISO string.
        ...(formData.get("listingType") === "auction" && {
          auctionEndsAt: formData.get("auctionEndsAt"),
          minIncrement: Number(formData.get("minIncrement") || 1),
        }),
      }),
    });
    return { listingId: listing.id };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Uploads one listing photo as soon as it is picked on the form. One photo per call keeps each
 * request small: the form sends at most MAX_PHOTO_MB (4 MB) per photo, under Vercel's 4.5 MB
 * request limit and the 6 MB Server Action limit (next.config.ts).
 */
export async function uploadListingPhoto(formData: FormData): Promise<ActionResult & { url?: string }> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Choose a photo to upload." };
  try {
    return { url: await uploadPhoto(photo) };
  } catch (error) {
    return toActionError(error);
  }
}

/** Sends the image bytes to the API's upload route and returns the photo's public URL. */
async function uploadPhoto(photo: File): Promise<string> {
  const { url } = await apiFetch<{ url: string }>("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": photo.type },
    body: photo,
  });
  return url;
}

/** The photo URLs PhotoPicker put in hidden inputs, in order. */
function photoUrls(formData: FormData): string[] {
  return formData.getAll("imageUrls").filter((value): value is string => typeof value === "string");
}

/**
 * Saves an edited listing. The form starts with the current photos, so its photo URLs are the
 * complete new list: an empty list removes them all. Once an auction has bids the form leaves out
 * its type and price, so they are not sent: fields set to `undefined` here are dropped by JSON.stringify.
 */
export async function updateListing(id: string, formData: FormData): Promise<ActionResult & { listingId?: string }> {
  try {
    const price = formData.get("price");
    const listingType = formData.get("listingType") ?? undefined;
    const isAuction = listingType === "auction";
    await apiFetch(`/api/listings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        category: formData.get("category"),
        condition: formData.get("condition"),
        listingType,
        // A giveaway is free, as on the create form.
        price: listingType === "giveaway" ? 0 : price === null ? undefined : Number(price || 0),
        // The form has already turned the local end time into an ISO string.
        auctionEndsAt: isAuction ? formData.get("auctionEndsAt") : undefined,
        minIncrement: isAuction ? Number(formData.get("minIncrement") || 1) : undefined,
        imageUrls: photoUrls(formData),
      }),
    });
    return { listingId: id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateListingStatus(id: string, status: ListingStatus): Promise<ActionResult> {
  try {
    await apiFetch(`/api/listings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh(); // re-render the page so the new status shows
  return {};
}

export async function deleteListing(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/listings/${encodeURIComponent(id)}`, { method: "DELETE" });
    return {};
  } catch (error) {
    return toActionError(error);
  }
}

/** Saves (heart on) or unsaves a listing for the signed-in user. Doing either twice is fine. */
export async function setListingSaved(listingId: string, saved: boolean): Promise<ActionResult> {
  try {
    await apiFetch(`/api/listings/${encodeURIComponent(listingId)}/save`, { method: saved ? "POST" : "DELETE" });
  } catch (error) {
    return toActionError(error);
  }
  refresh(); // re-render the page: the heart, the save count and the Saved page's list
  return {};
}

/** Places a bid on an auction. The API enforces the rules (minimum amount, not your own, not ended). */
export async function placeBid(listingId: string, amount: number): Promise<ActionResult> {
  try {
    await apiFetch(`/api/listings/${encodeURIComponent(listingId)}/bids`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh(); // re-render the listing so the new highest bid shows
  return {};
}

/** Offers less than the asking price. A new offer replaces your pending one. The API enforces the rules. */
export async function makeOffer(listingId: string, amount: number): Promise<ActionResult> {
  try {
    await apiFetch(`/api/listings/${encodeURIComponent(listingId)}/offers`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh(); // re-render the listing so the offer's status shows
  return {};
}

/**
 * Accepts, declines or withdraws an offer. Not exported, so it is not a Server Action itself:
 * `step` only ever comes from the three wrappers below, never from the browser.
 */
async function changeOffer(offerId: string, step: "accept" | "decline" | "withdraw"): Promise<ActionResult> {
  try {
    await apiFetch(`/api/offers/${encodeURIComponent(offerId)}/${step}`, { method: "POST" });
  } catch (error) {
    return toActionError(error);
  }
  refresh(); // re-render the listing: its status, the offers and the pay buttons
  return {};
}

/** The seller accepts an offer: the item is reserved for that buyer at that price. */
export async function acceptOffer(offerId: string): Promise<ActionResult> {
  return changeOffer(offerId, "accept");
}

/** The seller declines an offer. The item stays available. */
export async function declineOffer(offerId: string): Promise<ActionResult> {
  return changeOffer(offerId, "decline");
}

/** The buyer takes back their pending offer. */
export async function withdrawOffer(offerId: string): Promise<ActionResult> {
  return changeOffer(offerId, "withdraw");
}

/** Rates the other person in a finished deal. The API checks who may review whom. */
export async function submitReview(
  listingId: string,
  revieweeId: string,
  rating: number,
  comment: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/listings/${encodeURIComponent(listingId)}/reviews`, {
      method: "POST",
      body: JSON.stringify({ revieweeId, rating, comment }),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh(); // re-render the thread so your rating replaces the form
  return {};
}

/**
 * Starts a Stripe Checkout (test mode) for a listing. Returns the Stripe page to send the buyer to.
 * `returnOrigin` is the address the buyer is on (localhost, or the tunnel), so Stripe sends them back
 * where their sign-in cookie lives. The API only accepts its own known addresses.
 */
export async function startCheckout(listingId: string): Promise<ActionResult & { url?: string }> {
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const returnOrigin = host ? `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${host}` : undefined;
    const { url } = await apiFetch<{ url: string }>("/api/payments/checkout", {
      method: "POST",
      body: JSON.stringify({ listingId, returnOrigin }),
    });
    return { url };
  } catch (error) {
    return toActionError(error);
  }
}

/** Creates (or shows again) the KHQR that pays the seller of a listing. */
export async function startKhqrPayment(listingId: string): Promise<ActionResult & { payment?: KhqrPayment }> {
  try {
    const payment = await apiFetch<KhqrPayment>("/api/payments/khqr", {
      method: "POST",
      body: JSON.stringify({ listingId }),
    });
    return { payment };
  } catch (error) {
    return toActionError(error);
  }
}

/** Asked every few seconds by the KHQR screen. Null when the API or Bakong could not answer this time. */
export async function checkKhqrPayment(paymentId: string): Promise<KhqrStatus | null> {
  try {
    return await getKhqrStatus(paymentId);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** Whether the API has a Telegram bot set up, and whether this account is linked to it. */
export async function getTelegramStatus(): Promise<{ enabled: boolean; connected: boolean }> {
  try {
    return await apiFetch<{ enabled: boolean; connected: boolean }>("/api/users/me/telegram");
  } catch (error) {
    console.error(error);
    return { enabled: false, connected: false };
  }
}

/** A one-time t.me link; pressing Start in Telegram links the chat to this account. */
export async function connectTelegram(): Promise<ActionResult & { link?: string }> {
  try {
    const { link } = await apiFetch<{ link: string }>("/api/users/me/telegram", { method: "POST" });
    return { link };
  } catch (error) {
    return toActionError(error);
  }
}

export async function disconnectTelegram(): Promise<ActionResult> {
  try {
    await apiFetch("/api/users/me/telegram", { method: "DELETE" });
    return {};
  } catch (error) {
    return toActionError(error);
  }
}

export async function sendMessage(listingId: string, receiverId: string, body: string): Promise<ActionResult> {
  try {
    await apiFetch("/api/messages", {
      method: "POST",
      body: JSON.stringify({ listingId, receiverId, body }),
    });
  } catch (error) {
    return toActionError(error);
  }
  refresh(); // re-render the thread so the new message shows
  return {};
}

/**
 * Asks the shopping assistant the last question in `messages`. The API keeps no history, so the
 * whole conversation goes with every question, as role and text only (not the cards).
 */
export async function askAssistant(messages: AssistantMessage[]): Promise<ActionResult & { answer?: AssistantAnswer }> {
  try {
    const answer = await apiFetch<AssistantAnswer>("/api/assistant", {
      method: "POST",
      body: JSON.stringify({ messages: messages.map(({ role, text }) => ({ role, text })) }),
    });
    return { answer };
  } catch (error) {
    return toActionError(error);
  }
}
