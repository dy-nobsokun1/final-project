import { cookies } from "next/headers";

/**
 * Where the Express API runs (see backend/README.md). Only the Next.js server calls it,
 * never the browser, so this is a plain server variable and not NEXT_PUBLIC_.
 */
export const API_URL = process.env.API_URL ?? "http://localhost:4000";

/** Name of the httpOnly cookie that holds the login token (a JWT issued by the API). */
export const TOKEN_COOKIE = "uniswap_token";

/** An error response from the API, which always looks like `{ error, details }`. */
export class ApiError extends Error {
  status: number;
  details: Record<string, string>;

  constructor(status: number, message: string, details: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * Calls the API from the server and returns the parsed JSON body.
 * Sends the signed-in user's token unless the caller passes its own Authorization header,
 * and throws an `ApiError` for any response that is not 2xx.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? "Request failed.", body.details ?? {});
  }
  return body as T;
}
