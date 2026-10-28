import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Passwords are hashed with scrypt from Node's built-in crypto module (no extra package).
// Stored format: "<salt>:<hash>", both hex.

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, salt, KEY_LENGTH);
  // Constant-time comparison so response timing does not leak how close a guess was.
  return timingSafeEqual(expected, actual);
}
