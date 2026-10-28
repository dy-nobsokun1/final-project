import { createHmac, randomInt } from "node:crypto";
import { config } from "../config.js";

// The 6-digit code emailed at sign-up, in place of a link (a link to a trycloudflare.com address made
// school Outlook send the email to Junk). It works for CODE_MINUTES and allows MAX_ATTEMPTS tries.
export const CODE_MINUTES = 30;
export const MAX_ATTEMPTS = 5;

/** A random code like "042917". randomInt is cryptographically secure; padStart keeps leading zeros. */
export function newVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** True for exactly six digits. Anything else cannot be a code, so it does not use up a try. */
export function isCodeFormat(code) {
  return typeof code === "string" && /^\d{6}$/.test(code);
}

// Only this hash is stored. A plain SHA-256 of a 6-digit code could be reversed by trying all million
// codes, so anyone who read the database (a leaked backup) would learn every pending code. The HMAC
// needs the server's JWT_SECRET, which the database does not hold.
export function hashVerificationCode(code) {
  return createHmac("sha256", config.jwtSecret).update(code).digest("hex");
}
