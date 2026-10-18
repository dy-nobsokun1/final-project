import { createHash } from "node:crypto";
import { config } from "../config.js";

// Cloudinary image hosting, called through its web API with fetch (no extra package).
// Photos survive server restarts and redeploys, unlike files on Render's disk.

const { cloudName, apiKey, apiSecret } = config.cloudinary;
const FOLDER = "uniswap";

export const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

/**
 * Every photo uploadImage stores has a URL starting with this, e.g.
 * https://res.cloudinary.com/<cloud>/image/upload/v1712345678/uniswap/abc123.jpg
 */
export const CLOUDINARY_PHOTO_PREFIX = `https://res.cloudinary.com/${cloudName}/image/upload/`;

/**
 * Cloudinary's signature: SHA-1 of the signed parameters, sorted by name and joined as
 * "a=1&b=2", with the API secret appended. It proves the upload comes from us without
 * sending the secret itself.
 */
export function signParams(params, secret) {
  const joined = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("&");
  return createHash("sha1").update(joined + secret).digest("hex");
}

/** Uploads image bytes and returns the image's public https URL. */
export async function uploadImage(bytes, contentType) {
  const signed = { folder: FOLDER, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }));
  form.append("api_key", apiKey);
  form.append("folder", signed.folder);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signParams(signed, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Cloudinary upload failed: ${result.error?.message ?? response.status}`);
  return result.secure_url;
}
