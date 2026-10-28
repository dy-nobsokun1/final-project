import { query } from "../db/pool.js";
import { HttpError } from "../utils/httpError.js";
import { verifyToken } from "../utils/token.js";

/**
 * Blocks the request unless it carries a valid "Authorization: Bearer <token>" header
 * for an account that still exists, has verified its email, and was issued after its last password change.
 */
export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token) throw new HttpError(401, "Please log in first.");

  let session;
  try {
    session = verifyToken(token);
  } catch {
    throw new HttpError(401, "Your session has expired. Please log in again.");
  }
  // Every token signToken makes carries its issue time (iat). Without it we cannot tell whether
  // the token is older than the last password change, so it is refused.
  if (!Number.isInteger(session.issuedAt)) throw new HttpError(401, "Please log in again.");

  // The token proves who is asking; the database says whether that account may still act.
  const { rows: [user] } = await query(
    "SELECT is_verified, password_changed_at FROM users WHERE id = $1",
    [session.userId],
  );
  if (!user?.is_verified) throw new HttpError(401, "Please log in again.");
  // iat counts whole seconds, so the change time is rounded down too: the token change-password
  // returns in the same second must still work. pg returns TIMESTAMPTZ as a JS Date.
  if (user.password_changed_at && session.issuedAt < Math.floor(user.password_changed_at.getTime() / 1000)) {
    throw new HttpError(401, "Your password was changed. Please log in again.");
  }

  req.userId = session.userId;
  next();
}
