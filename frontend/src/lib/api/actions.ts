"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { ApiError, apiFetch, TOKEN_COOKIE } from "@/lib/api/http";
import { getKhqrStatus } from "@/lib/api";
import type { KhqrPayment, KhqrStatus, ListingStatus, ListingWithSeller, User } from "@/types";

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
    // No session is created here: the account stays locked until its email link is opened.
    await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(values) });
    return {};
  } catch (error) {
    return toActionError(error);
  }
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(TOKEN_COOKIE);
}

/** Emails a fresh verification link. The password proves the request comes from whoever registered. */
export async function resendVerification(email: string, password: string): Promise<ActionResult> {
  try {
    await apiFetch("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
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

/** Uploads the photo (if any), then creates the listing. Returns the new listing's id. */
export async function createListing(formData: FormData): Promise<ActionResult & { listingId?: string }> {
  try {
    const photo = formData.get("photo");
    const imageUrls = photo instanceof File && photo.size > 0 ? [await uploadPhoto(photo)] : [];
    const { listing } = await apiFetch<{ listing: ListingWithSeller }>("/api/listings", {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        category: formData.get("category"),
        condition: formData.get("condition"),
        listingType: formData.get("listingType"),
        price: Number(formData.get("price") || 0),
        imageUrls,
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

/** Sends the image bytes to the API's upload route and returns the photo's public URL. */
async function uploadPhoto(photo: File): Promise<string> {
  const { url } = await apiFetch<{ url: string }>("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": photo.type },
    body: photo,
  });
  return url;
}

/**
 * Saves an edited listing. A newly chosen photo replaces the old one; with no new photo the old one
 * stays. Once an auction has bids the form leaves out its type and price, so they are not sent:
 * fields set to `undefined` here are dropped by JSON.stringify.
 */
export async function updateListing(id: string, formData: FormData): Promise<ActionResult & { listingId?: string }> {
  try {
    const photo = formData.get("photo");
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
        imageUrls: photo instanceof File && photo.size > 0 ? [await uploadPhoto(photo)] : undefined,
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

/** Starts a Stripe Checkout (test mode) for a listing. Returns the Stripe page to send the buyer to. */
export async function startCheckout(listingId: string): Promise<ActionResult & { url?: string }> {
  try {
    const { url } = await apiFetch<{ url: string }>("/api/payments/checkout", {
      method: "POST",
      body: JSON.stringify({ listingId }),
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
