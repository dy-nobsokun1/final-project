// Sends one picked photo to POST /api/uploads as raw bytes and returns the address the API gives back
// ({ url }). The picker hands us the photo as base64 JPEG data, so the bytes are always image/jpeg.
import { fetch } from "expo/fetch";

import { API_URL, ApiError } from "@/lib/api";

/**
 * The API's own limit (MAX_SIZE "5mb" in backend/src/routes/uploads.js, counted as 5 x 1024 x 1024 bytes).
 * The website uses 4 MB because Vercel sits in its path; the phone posts straight to the API.
 */
export const MAX_PHOTO_MB = 5;

/** Base64 text to bytes. atob is built into the app's JavaScript engine (Hermes). */
function toBytes(base64: string): Uint8Array {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

export async function uploadPhoto(base64: string, token: string): Promise<string> {
  const bytes = toBytes(base64);
  if (bytes.length > MAX_PHOTO_MB * 1024 * 1024) {
    throw new ApiError(`This photo is too big. Use one under ${MAX_PHOTO_MB} MB.`, 413);
  }
  let response;
  try {
    response = await fetch(`${API_URL}/api/uploads`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", Authorization: `Bearer ${token}` },
      body: bytes.buffer as ArrayBuffer,
    });
  } catch {
    throw new ApiError("Cannot reach UniSwap. Check your connection and try again.", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new ApiError(data.error ?? "The photo could not be uploaded.", response.status);
  return data.url as string;
}
