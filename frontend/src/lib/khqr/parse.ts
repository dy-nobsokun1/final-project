// A KHQR is plain text in the EMVCo format: a list of fields, each written as 2-digit tag +
// 2-digit length + value ("5802KH" is tag 58, length 02, value "KH"). The last field (tag 63) is a
// CRC-16 checksum of everything before it. This file turns the text of a seller's own KHQR into the
// Bakong account ID inside it. It is the reverse of buildKhqr() in backend/src/utils/khqr.js.

export const KHQR_MESSAGES = {
  notKhqr: "This QR is not a KHQR. Upload the KHQR from your banking app.",
  merchant:
    "This is a merchant QR. UniSwap needs your personal KHQR, the one you use to receive money as yourself.",
  noId: "This KHQR has no payment ID that UniSwap can use.",
} as const;

export type KhqrIdResult = { id: string } | { error: string };

// The same rule as isBakongAccountId() in backend/src/utils/validation.js: name@bank, at most 32 characters.
const BAKONG_ACCOUNT_ID = /^[a-z0-9._-]+@[a-z0-9]+$/i;
const MAX_ID_LENGTH = 32;

/** CRC-16/CCITT-FALSE (polynomial 0x1021, starting at 0xFFFF), as 4 uppercase hex digits. */
function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

interface Field {
  tag: string;
  value: string;
  next: number;
}

/** The field that starts at `start`, or null if there is no well-formed tag + length + value there. */
function fieldAt(text: string, start: number): Field | null {
  const header = text.slice(start, start + 4);
  if (!/^\d{4}$/.test(header)) return null;
  const end = start + 4 + Number(header.slice(2));
  if (end > text.length) return null;
  return { tag: header.slice(0, 2), value: text.slice(start + 4, end), next: end };
}

/** The value of the first field with this tag, or null. Stops at the first field that is malformed. */
function findField(text: string, tag: string, stopAt?: string): string | null {
  for (let start = 0; start < text.length; ) {
    const field = fieldAt(text, start);
    if (!field || (stopAt && field.tag >= stopAt)) return null;
    if (field.tag === tag) return field.value;
    start = field.next;
  }
  return null;
}

/**
 * The Bakong account ID in the text of a personal KHQR, or the reason it cannot be used. A QR whose
 * checksum fails is refused as "not a KHQR", which also catches a code that was misread or edited.
 */
export function readKhqrId(text: string): KhqrIdResult {
  const withoutCrc = text.slice(0, -4);
  const isKhqr =
    text.startsWith("000201") && withoutCrc.endsWith("6304") && text.slice(-4).toUpperCase() === crc16(withoutCrc);
  if (!isKhqr) return { error: KHQR_MESSAGES.notKhqr };

  // Account tags (02-51) come before tag 52, so the walk stops there. That keeps it away from the
  // name and city fields, whose Khmer letters would make a character count differ from the length.
  const personal = findField(text, "29", "52");
  if (personal === null) {
    const isMerchant = findField(text, "30", "52") !== null;
    return { error: isMerchant ? KHQR_MESSAGES.merchant : KHQR_MESSAGES.noId };
  }
  const id = findField(personal, "00");
  const isUsable = id !== null && id.length <= MAX_ID_LENGTH && BAKONG_ACCOUNT_ID.test(id);
  return isUsable ? { id } : { error: KHQR_MESSAGES.noId };
}
