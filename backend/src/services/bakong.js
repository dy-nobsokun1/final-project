import { config } from "../config.js";
import { khqrMd5 } from "../utils/khqr.js";

// Bakong Open API (National Bank of Cambodia), called with fetch (no extra package). UniSwap only
// asks it one thing: "has this KHQR been paid?". The token comes from api-bakong.nbc.gov.kh and
// must be renewed every 90 days. Bakong only answers requests from Cambodian IP addresses.

const BAKONG_API = "https://api-bakong.nbc.gov.kh/v1";
const { token } = config.bakong;

export const isBakongConfigured = Boolean(token);

/**
 * True once someone has paid this exact KHQR. Bakong finds the payment by the MD5 of the QR text,
 * and that text contains the amount and the receiving account, so a match means it was paid in full.
 */
export async function isKhqrPaid(khqr) {
  const response = await fetch(`${BAKONG_API}/check_transaction_by_md5`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ md5: khqrMd5(khqr) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 403) throw new Error("Bakong refused the request (it only accepts Cambodian IP addresses).");
  if (!response.ok) throw new Error(`Bakong check failed: HTTP ${response.status}`);
  const result = await response.json();
  if (result.responseCode === 0) return true;
  // errorCode 1: nobody has paid this QR yet. 3: a payment was tried but failed.
  if (result.errorCode === 1 || result.errorCode === 3) return false;
  throw new Error(`Bakong check failed: ${result.responseMessage}`);
}
