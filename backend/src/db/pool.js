import pg from "pg";
import { config } from "../config.js";

// One shared connection pool for the whole app.
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Prevent backend crashes when an idle cloud connection is reset/closed by Supabase or network
pool.on("error", (err) => {
  console.error("[db] unexpected error on idle database client:", err.message);
});

// Always pass user input through `params` ($1, $2, ...), never string concatenation.
// That is what protects every query from SQL injection.
export function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Runs `work(client)` inside one database transaction: either every query in it is saved, or
 * (if anything throws) none are. Use client.query inside, not query(), so all calls share it.
 */
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
