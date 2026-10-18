import { randomBytes } from "node:crypto";
import { Router } from "express";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { sendVerificationEmail } from "../utils/email.js";
import { HttpError } from "../utils/httpError.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { toUser } from "../utils/serializers.js";
import { signToken } from "../utils/token.js";
import { validateRegistration } from "../utils/validation.js";

export const authRouter = Router();

/**
 * Emails the account's verification link. Returns false instead of throwing when email is not
 * set up or the mail server refuses, and then prints the link to the server log instead, so a
 * developer can still finish verification by hand.
 */
async function deliverVerificationLink(user) {
  const link = `${config.frontendOrigin}/verify-email?token=${user.verification_token}`;
  try {
    await sendVerificationEmail({ to: user.email, name: user.name, link });
    return true;
  } catch (error) {
    console.error(`[verify-email] could not email ${user.email}: ${error.response ?? error.message}`);
    console.log(`[verify-email] ${user.email}: ${link}`);
    return false;
  }
}

// Looks up an account by email and password. Same error for "no such user" and "wrong password",
// so attackers cannot probe for which emails have accounts.
async function findUserByCredentials(body) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (!user || !(await verifyPassword(String(body.password ?? ""), user.password_hash))) {
    throw new HttpError(401, "Email or password is incorrect.");
  }
  return user;
}

// POST /api/auth/register  { name, email, password, major?, graduationYear? }
// Creates a locked account: nobody is signed in until the emailed link proves they own the address.
authRouter.post("/register", async (req, res) => {
  const errors = validateRegistration(req.body);
  if (Object.keys(errors).length) throw new HttpError(400, "Please fix the highlighted fields.", errors);

  const b = req.body;
  // If someone registered this email but never verified it (a typo, or a stranger using your
  // address), the new sign-up replaces that account. A verified account is never touched:
  // the WHERE makes the upsert return no row, which we report as "already exists".
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, major, graduation_year, verification_token)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       major = EXCLUDED.major,
       graduation_year = EXCLUDED.graduation_year,
       verification_token = EXCLUDED.verification_token
     WHERE NOT users.is_verified
     RETURNING *`,
    [b.name.trim(), b.email.trim().toLowerCase(), await hashPassword(b.password),
      b.major ?? "", b.graduationYear ?? null, randomBytes(32).toString("hex")],
  );
  if (!rows[0]) throw new HttpError(409, "An account with this email already exists.");

  // Not awaited: sending can take a few seconds, and registration should not fail because of email.
  void deliverVerificationLink(rows[0]);

  res.status(201).json({ email: rows[0].email, verificationRequired: true });
});

// POST /api/auth/verify-email  { token }  -> unlocks the account so its owner can sign in
authRouter.post("/verify-email", async (req, res) => {
  const { rows } = await query(
    `UPDATE users SET is_verified = true, verification_token = NULL
     WHERE verification_token = $1 RETURNING *`,
    [String(req.body.token ?? "")],
  );
  if (!rows[0]) throw new HttpError(400, "This verification link is invalid or already used.");
  res.json({ user: toUser(rows[0], { includePrivate: true }) });
});

// POST /api/auth/resend-verification  { email, password } -> emails a fresh link; the old one stops working
// Asks for the password too, so a stranger cannot use this to flood someone's inbox.
authRouter.post("/resend-verification", async (req, res) => {
  const user = await findUserByCredentials(req.body);
  const { rows } = await query(
    `UPDATE users SET verification_token = $2
     WHERE id = $1 AND NOT is_verified RETURNING *`,
    [user.id, randomBytes(32).toString("hex")],
  );
  if (!rows[0]) throw new HttpError(400, "This account is already verified.");
  if (!(await deliverVerificationLink(rows[0]))) {
    throw new HttpError(502, "Could not send the email right now. Please try again later.");
  }
  res.json({ sent: true });
});

// POST /api/auth/login  { email, password }
authRouter.post("/login", async (req, res) => {
  const user = await findUserByCredentials(req.body);
  // Checked after the password, so only the person who registered learns the account is unverified.
  if (!user.is_verified) {
    throw new HttpError(403, "Verify your email before signing in. We sent you a link when you registered.");
  }
  res.json({ user: toUser(user, { includePrivate: true }), token: signToken(user.id) });
});

// GET /api/auth/me  -> the logged-in user
authRouter.get("/me", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.userId]);
  if (!rows[0]) throw new HttpError(401, "Account no longer exists.");
  res.json({ user: toUser(rows[0], { includePrivate: true }) });
});
