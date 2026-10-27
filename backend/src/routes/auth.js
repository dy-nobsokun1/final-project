import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { siteOrigin } from "../services/tunnel.js";
import { isEmailConfigured, sendPasswordResetEmail, sendVerificationEmail } from "../utils/email.js";
import { HttpError } from "../utils/httpError.js";
import { notifyPasswordChanged } from "../utils/notify.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { toUser } from "../utils/serializers.js";
import { signToken } from "../utils/token.js";
import { isCampusEmail, passwordError, validateRegistration } from "../utils/validation.js";

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

// Unlike a password, a reset token is 32 random bytes and cannot be guessed, so a plain SHA-256
// is enough (no salt or slow scrypt). The database keeps only this hash, so a leak holds no usable link.
function hashResetToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/** Emails a password-reset link. Never throws: the request has already been answered. */
async function deliverResetLink(user, token) {
  const link = `${siteOrigin()}/reset-password?token=${token}`;
  if (!isEmailConfigured) {
    // Whenever SMTP is not configured, the link is printed instead, so a developer can still reset by
    // hand. Never in production (render.yaml sets NODE_ENV), and never once email is set up, not even
    // when sending fails: a reset link in the server log lets anyone who reads the log take over the account.
    if (process.env.NODE_ENV === "production") {
      console.error(`[reset-password] could not email ${user.email}: email is not set up, and reset links are never printed in production`);
    } else {
      console.log(`[reset-password] ${user.email}: ${link}`);
    }
    return;
  }
  try {
    await sendPasswordResetEmail({ to: user.email, name: user.name, link });
  } catch (error) {
    console.error(`[reset-password] could not email ${user.email}: ${error.response ?? error.message}`);
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

// POST /api/auth/forgot-password  { email } -> always { requested: true }
// The same answer for every campus address, so this route itself does not tell who has an account.
// Unverified accounts get a link too (see reset-password).
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body ?? {};
  if (!isCampusEmail(email)) {
    throw new HttpError(400, "Please fix the highlighted fields.", { email: "Use your campus email (ending in .edu.kh)." });
  }
  // Made before the lookup, so a known and an unknown address take the same work.
  const token = randomBytes(32).toString("hex");
  // The 2-minute check sits in the UPDATE itself: if two requests arrive at the same moment,
  // PostgreSQL re-checks the WHERE on the locked row, so only one email goes out. A throttled
  // request changes nothing, so the link in the earlier email keeps working. It only applies while
  // that link is unused (password_reset_hash is set): after a reset, e.g. with a mistyped password,
  // a new link goes out straight away.
  const { rows } = await query(
    `UPDATE users SET password_reset_hash = $2, password_reset_expires_at = now() + interval '1 hour',
       password_reset_sent_at = now()
     WHERE email = $1 AND (password_reset_hash IS NULL OR password_reset_sent_at IS NULL
       OR password_reset_sent_at < now() - interval '2 minutes')
     RETURNING email, name`,
    [email.trim().toLowerCase(), hashResetToken(token)],
  );
  // Not awaited: the answer takes the same time whether or not an email is sent.
  if (rows[0]) void deliverResetLink(rows[0], token);
  res.json({ requested: true });
});

// POST /api/auth/reset-password  { token, password } -> sets the new password; the person signs in next
authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body ?? {};
  // Checked first, so a too-short password does not use up the link.
  const problem = passwordError(password);
  if (problem) throw new HttpError(400, "Please fix the highlighted fields.", { password: problem });

  // One UPDATE both checks the link and uses it up, so it works once even if submitted twice at
  // the same moment. Opening a link sent to the address proves the inbox, which is what
  // verification proves, so this also verifies the account (and replaces any password a stranger
  // chose when registering this address). password_changed_at uses Node's clock because
  // requireAuth compares it with the token's iat, which Node stamps. An unused Telegram connect code
  // is cancelled too: a stolen session may have asked for one to use later (routes/telegram.js).
  const { rows } = await query(
    `UPDATE users SET password_hash = $2, password_changed_at = $3, password_reset_hash = NULL,
       password_reset_expires_at = NULL, is_verified = true, verification_token = NULL,
       telegram_link_code = NULL
     WHERE password_reset_hash = $1 AND password_reset_expires_at > now()
     RETURNING id`,
    [hashResetToken(String(token ?? "")), await hashPassword(password), new Date()],
  );
  if (!rows[0]) throw new HttpError(400, "This reset link is invalid, expired or already used. Ask for a new one.");
  notifyPasswordChanged(rows[0].id);
  // No login token: an emailed link never signs anyone in by itself.
  res.json({ reset: true });
});

// POST /api/auth/change-password  { currentPassword, newPassword } -> { token } for this device
authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const problem = passwordError(newPassword);
  if (problem) throw new HttpError(400, "Please fix the highlighted fields.", { newPassword: problem });

  // The current password stops someone at a borrowed, signed-in laptop from locking the owner out.
  // A wrong one is a 400 with a field error, not a 401, so the frontend does not treat it as an expired session.
  const { rows: [user] } = await query("SELECT password_hash FROM users WHERE id = $1", [req.userId]);
  if (!(await verifyPassword(String(currentPassword ?? ""), user.password_hash))) {
    throw new HttpError(400, "Please fix the highlighted fields.", { currentPassword: "This is not your current password." });
  }

  // A pending reset link is cleared too, so an older email cannot undo this change, and so is an
  // unused Telegram connect code, as in reset-password.
  await query(
    `UPDATE users SET password_hash = $2, password_changed_at = $3, password_reset_hash = NULL,
       password_reset_expires_at = NULL, telegram_link_code = NULL
     WHERE id = $1`,
    [req.userId, await hashPassword(newPassword), new Date()],
  );
  notifyPasswordChanged(req.userId);
  // Every older token now stops working, this device's too, so it gets a fresh one. Its iat is
  // never below the change time rounded down to the second, so requireAuth accepts it.
  res.json({ token: signToken(req.userId) });
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
