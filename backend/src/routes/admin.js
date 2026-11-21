// Admin API: a small set of routes for the "admin" role (users.role). Every route here needs a login
// (requireAuth) AND the admin role, read from the database (requireAdmin). Both guards sit on the
// whole router, so a route added here later cannot be left open by mistake. Students get 403.
import { Router } from "express";
import { deleteListingWithRules } from "../db/deleteListing.js";
import { query } from "../db/pool.js";
import { requireAdmin } from "../middleware/admin.js";
import { requireAuth } from "../middleware/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// Turns rows of { key, count } into { key: count }. pg returns count(*) as text, so ::int in the SQL.
const toCounts = (rows) => Object.fromEntries(rows.map((row) => [row.key, row.count]));

// GET /api/admin/overview  -> { overview }: how the whole marketplace is doing, in numbers.
adminRouter.get("/overview", async (req, res) => {
  const [{ rows: [totals] }, { rows: byStatus }, { rows: byType }] = await Promise.all([
    query(
      `SELECT
         (SELECT count(*) FROM users WHERE is_verified)::int                             AS verified_users,
         (SELECT count(*) FROM users WHERE NOT is_verified)::int                         AS unverified_users,
         (SELECT count(*) FROM users WHERE role = 'admin')::int                          AS admins,
         (SELECT count(*) FROM listings)::int                                            AS listings,
         (SELECT count(*) FROM messages)::int                                            AS messages,
         (SELECT count(*) FROM payments WHERE status = 'paid')::int                      AS paid_payments,
         (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'paid')           AS paid_total,
         (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int    AS new_users,
         (SELECT count(*) FROM listings WHERE created_at > now() - interval '7 days')::int AS new_listings`,
    ),
    query("SELECT status AS key, count(*)::int AS count FROM listings GROUP BY status ORDER BY status"),
    query("SELECT listing_type AS key, count(*)::int AS count FROM listings GROUP BY listing_type ORDER BY listing_type"),
  ]);
  res.json({
    overview: {
      users: { verified: totals.verified_users, unverified: totals.unverified_users, admins: totals.admins },
      listings: { total: totals.listings, byStatus: toCounts(byStatus), byType: toCounts(byType) },
      messages: totals.messages,
      payments: { paid: totals.paid_payments, paidTotal: Number(totals.paid_total) },
      lastSevenDays: { newUsers: totals.new_users, newListings: totals.new_listings },
    },
  });
});

// GET /api/admin/users?limit=50  -> { users }: newest accounts first (limit 1-100, default 50).
// Emails are shown here, to admins only; public profiles never show them.
adminRouter.get("/users", async (req, res) => {
  const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 50, 1), 100);
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.is_verified, u.role, u.created_at,
            (SELECT count(*) FROM listings l WHERE l.user_id = u.id)::int AS listing_count
     FROM users u
     ORDER BY u.created_at DESC, u.id
     LIMIT $1`,
    [limit],
  );
  res.json({
    users: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      isVerified: row.is_verified,
      role: row.role,
      createdAt: row.created_at,
      listingCount: row.listing_count,
    })),
  });
});

// DELETE /api/admin/listings/:id  -> 204. Moderation: removes ANY student's listing, under exactly the
// same rules as the owner's own delete (db/deleteListing.js): 409 when it is sold or traded, reserved,
// reviewed or paid for; 404 when it does not exist.
adminRouter.delete("/listings/:id", async (req, res) => {
  await deleteListingWithRules(req.params.id);
  res.status(204).end();
});
