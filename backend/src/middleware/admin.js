import { query } from "../db/pool.js";
import { HttpError } from "../utils/httpError.js";

/**
 * Admin-only guard. Runs after requireAuth, which has already checked the token and set req.userId.
 * The role is read from the database on every request, never from the token: a token cannot claim to
 * be an admin, and taking the role away works at once, without waiting for old tokens to expire.
 */
export async function requireAdmin(req, res, next) {
  const { rows: [user] } = await query("SELECT role FROM users WHERE id = $1", [req.userId]);
  if (user?.role !== "admin") throw new HttpError(403, "Admins only.");
  next();
}
