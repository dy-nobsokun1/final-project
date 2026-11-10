import { randomBytes } from "node:crypto";

// The one-time code in the Settings "Connect Telegram" link. It carries its own creation time, so it
// can expire without a new database column: <32 random hex characters>_<Date.now() in base 36>.
// Telegram start parameters allow A-Z a-z 0-9 _ - and at most 64 characters; this is about 41.
// The bot still looks up the WHOLE code in the database, so nobody can change the time part.

/** How long a link from Settings works. */
export const LINK_CODE_MINUTES = 30;
const CODE = /^[0-9a-f]{32}_([0-9a-z]{1,12})$/;

/** A new one-time code, made at `now` (milliseconds). */
export function newLinkCode(now = Date.now()) {
  return `${randomBytes(16).toString("hex")}_${now.toString(36)}`;
}

/**
 * True when `code` has the format above and was made at most LINK_CODE_MINUTES before `now`.
 * Codes without a time part (made before this change) and anything else count as expired.
 */
export function isLinkCodeFresh(code, now = Date.now()) {
  const match = typeof code === "string" ? CODE.exec(code) : null;
  if (!match) return false;
  const ageMs = now - parseInt(match[1], 36);
  return ageMs <= LINK_CODE_MINUTES * 60 * 1000;
}
