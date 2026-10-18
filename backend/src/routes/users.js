import { Router } from "express";
import { LISTING_SELECT } from "../db/listings.js";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../utils/httpError.js";
import { toListing, toUser } from "../utils/serializers.js";
import { isBakongAccountId } from "../utils/validation.js";

export const usersRouter = Router();

// PATCH /api/users/me  { name?, major?, graduationYear?, bio?, avatarUrl?, bakongAccountId? }
// Declared before "/:id" so "me" is not treated as an id.
usersRouter.patch("/me", requireAuth, async (req, res) => {
  const b = req.body;
  if (b.name !== undefined && (typeof b.name !== "string" || !b.name.trim())) {
    throw new HttpError(400, "Name cannot be empty.");
  }
  if (b.graduationYear !== undefined && b.graduationYear !== null && !Number.isInteger(b.graduationYear)) {
    throw new HttpError(400, "Graduation year must be a whole number.");
  }
  // Bakong account for KHQR payments. "" or null removes it.
  const bakongAccountId = typeof b.bakongAccountId === "string" ? b.bakongAccountId.trim() || null : b.bakongAccountId;
  if (bakongAccountId != null && !isBakongAccountId(bakongAccountId)) {
    throw new HttpError(400, "Enter your Bakong account ID like name@bank (at most 32 characters).");
  }
  // COALESCE keeps the current value when a field is not sent. The Bakong account uses CASE
  // instead, because null is a real value for it (removed): $7 says whether it was sent.
  const { rows } = await query(
    `UPDATE users SET
       name = COALESCE($2, name),
       major = COALESCE($3, major),
       graduation_year = COALESCE($4, graduation_year),
       bio = COALESCE($5, bio),
       avatar_url = COALESCE($6, avatar_url),
       bakong_account_id = CASE WHEN $7 THEN $8 ELSE bakong_account_id END
     WHERE id = $1 RETURNING *`,
    [req.userId, b.name?.trim(), b.major, b.graduationYear, b.bio, b.avatarUrl,
      bakongAccountId !== undefined, bakongAccountId ?? null],
  );
  res.json({ user: toUser(rows[0], { includePrivate: true }) });
});

// GET /api/users/:id  -> public profile (no email)
usersRouter.get("/:id", async (req, res) => {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.params.id]);
  if (!rows[0]) throw new HttpError(404, "User not found.");
  res.json({ user: toUser(rows[0]) });
});

// GET /api/users/:id/listings  -> everything that user has posted, in any status
usersRouter.get("/:id/listings", async (req, res) => {
  const { rows } = await query(
    `${LISTING_SELECT} WHERE l.user_id = $1 ORDER BY l.created_at DESC`,
    [req.params.id],
  );
  res.json({ listings: rows.map(toListing) });
});
