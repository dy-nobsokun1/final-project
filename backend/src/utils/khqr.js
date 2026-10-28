import { createHash } from "node:crypto";

// KHQR is Cambodia's national QR payment standard, run by the National Bank's Bakong system. Any
// Bakong-linked banking app (ABA, ACLEDA, Wing, ...) can pay one. A KHQR is plain text in the
// EMVCo format: a list of fields, each written as 2-digit tag + 2-digit length + value. For example
// "5802KH" is tag 58 (country), length 02, value "KH". The last field (tag 63) is a CRC-16 checksum
// of everything before it, so a banking app rejects a code that was misread or edited.

/** One field: tag + length + value. Values here are plain ASCII, so length = number of characters. */
export function field(tag, value) {
  const text = String(value);
  return `${tag}${String(text.length).padStart(2, "0")}${text}`;
}

/** CRC-16/CCITT-FALSE (polynomial 0x1021, starting at 0xFFFF), as 4 uppercase hex digits. */
export function crc16(text) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** 25 -> "25", 12.5 -> "12.50": the same format as the National Bank's own KHQR library. */
function formatAmount(amount) {
  const value = Number(amount);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * The KHQR name field only allows plain ASCII, at most 25 characters. Accents are dropped
 * ("Chéa" -> "Chea") and other scripts are removed. Banking apps show the account's registered
 * name anyway, so this is only a fallback label.
 */
export function toAsciiName(name) {
  const ascii = String(name).normalize("NFKD").replace(/[^\x20-\x7E]/g, "").trim();
  return ascii.slice(0, 25).trim() || "UniSwap seller";
}

/**
 * A one-time ("dynamic") KHQR for an exact amount in US dollars, paid to one person's Bakong
 * account. `accountId` and `billNumber` must be plain ASCII; pass the name through toAsciiName().
 */
export function buildKhqr({ accountId, receiverName, amount, billNumber, createdAt, expiresAt }) {
  const fields = [
    field("00", "01"), // format version
    field("01", "12"), // 12 = dynamic: one payment of a fixed amount
    field("29", field("00", accountId)), // pay an individual's Bakong account
    field("52", "5999"), // merchant category: miscellaneous retail
    field("53", "840"), // currency: 840 = US dollar (ISO 4217)
    field("54", formatAmount(amount)),
    field("58", "KH"),
    field("59", receiverName),
    field("60", "Phnom Penh"),
    field("62", field("01", billNumber) + field("03", "UniSwap")), // bill number, store label
    field("99", field("00", createdAt.getTime()) + field("01", expiresAt.getTime())), // created, expires (ms)
  ].join("");
  return `${fields}6304${crc16(`${fields}6304`)}`;
}

/** True if a QR made by buildKhqr pays `accountId`: its tag 29 always follows tags 00 and 01. */
export function khqrPaysAccount(khqr, accountId) {
  return khqr.startsWith(field("00", "01") + field("01", "12") + field("29", field("00", accountId)));
}

/** Bakong looks a payment up by the MD5 hash of the exact QR text that was paid. */
export function khqrMd5(khqr) {
  return createHash("md5").update(khqr).digest("hex");
}
