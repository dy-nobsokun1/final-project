// Gives an account the admin role.  Run: npm run db:make-admin -- <email> [name]
// - The account exists: its role becomes 'admin' (nothing else changes).
// - It does not exist: it is created, verified, with the demo password "password123", but ONLY for an
//   @demo.edu.kh address (a demo domain that receives no email). A real student signs up and verifies
//   first, then this script promotes them. Safe to re-run.
// Example: npm run db:make-admin -- admin@demo.edu.kh "UniSwap Admin"
import { pool } from "../src/db/pool.js";
import { hashPassword } from "../src/utils/password.js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const name = (process.argv[3] ?? "UniSwap Admin").trim();

if (!email.endsWith(".edu.kh") || !email.includes("@")) {
  console.error("Usage: npm run db:make-admin -- <email ending in .edu.kh> [name]");
  process.exit(1);
}

// Says which database is about to change (host only, never the password in the URL).
console.log(`Database: ${new URL(process.env.DATABASE_URL).host}`);

const { rows: [existing] } = await pool.query(
  "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING name, is_verified", [email]);

if (existing) {
  console.log(`${email} (${existing.name}) is now an admin.${existing.is_verified ? "" : " It is not verified yet, so it cannot log in until it is."}`);
} else if (!email.endsWith("@demo.edu.kh")) {
  console.error(`No account for ${email}. Sign up and verify it first; only @demo.edu.kh admins are created here.`);
  process.exitCode = 1;
} else if (name.length < 1 || name.length > 80) {
  console.error("The name must be 1 to 80 characters.");
  process.exitCode = 1;
} else {
  // ON CONFLICT: if the same account was created a moment ago, it is still just made an admin.
  await pool.query(
    `INSERT INTO users (name, email, password_hash, is_verified, role) VALUES ($1, $2, $3, true, 'admin')
     ON CONFLICT (email) DO UPDATE SET role = 'admin'`,
    [name, email, await hashPassword("password123")],
  );
  console.log(`Created the admin ${email} (${name}), verified, password "password123".`);
}

const { rows } = await pool.query("SELECT role, count(*)::int AS count FROM users GROUP BY role ORDER BY role");
console.log("Accounts by role:", Object.fromEntries(rows.map((row) => [row.role, row.count])));
await pool.end();
