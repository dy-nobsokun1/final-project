// Talks to the UniSwap API (backend/). Every screen calls apiFetch, which adds the base address,
// sends JSON, adds "Authorization: Bearer <token>" when signed in, and turns { error } into an ApiError.

/** The API's address, from mobile/.env. In the iPhone simulator, localhost is the Mac itself. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

/** A failed request. `status` is the HTTP status, or 0 when the API could not be reached at all. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Cannot reach UniSwap. Check your connection and try again.", 0);
  }

  if (response.status === 204) return undefined as T; // e.g. unsave: nothing to read
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error ?? `Something went wrong (${response.status}).`, response.status);
  return data as T;
}

/** The message to show for any error a request throws. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
