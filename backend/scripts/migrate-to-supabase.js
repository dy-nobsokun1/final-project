import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const localUrl = process.env.LOCAL_DATABASE_URL ?? "postgres://uniswap:uniswap@localhost:5433/uniswap";
const targetUrl = process.env.SUPABASE_DATABASE_URL;

if (!targetUrl) {
  console.error("Missing SUPABASE_DATABASE_URL in environment.");
  process.exit(1);
}

console.log("--- Starting Migration from Local Postgres to Supabase ---");
console.log("Source:", localUrl);
console.log("Target:", targetUrl.replace(/:[^:@]+@/, ":****@"));

const sourcePool = new pg.Pool({ connectionString: localUrl });
const targetPool = new pg.Pool({ connectionString: targetUrl });

try {
  // Test connections
  await sourcePool.query("SELECT 1");
  console.log("Connected to local database.");

  await targetPool.query("SELECT 1");
  console.log("Connected to Supabase database.");

  // Apply schema
  console.log("Applying schema.sql to Supabase...");
  const schemaSql = readFileSync(resolve(import.meta.dirname, "../src/db/schema.sql"), "utf-8");
  await targetPool.query(schemaSql);
  console.log("Schema applied successfully.");

  // Tables to migrate in dependency order
  const tables = [
    "users",
    "listings",
    "bids",
    "offers",
    "payments",
    "messages",
    "reviews",
    "saved_listings",
  ];

  for (const table of tables) {
    // Get column names that are not generated columns
    const colRes = await sourcePool.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = $1 AND is_generated != 'ALWAYS'
       ORDER BY ordinal_position`,
      [table],
    );
    const cols = colRes.rows.map((r) => r.column_name);
    const colList = cols.map((c) => `"${c}"`).join(", ");

    const { rows } = await sourcePool.query(`SELECT ${colList} FROM ${table}`);
    console.log(`Migrating ${table}: ${rows.length} rows...`);
    if (rows.length === 0) continue;

    for (const row of rows) {
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const values = cols.map((c) => row[c]);
      await targetPool.query(
        `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values,
      );
    }
    console.log(`Done ${table}.`);
  }

  console.log("--- Migration Completed Successfully! ---");
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exit(1);
} finally {
  await sourcePool.end();
  await targetPool.end();
}
