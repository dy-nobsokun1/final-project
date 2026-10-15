// Recreates every table in the TEST database from schema.sql, so each run starts empty.
// `npm run test:api` runs this first. useTestDatabase() refuses to touch the real database.
import { readFile } from "node:fs/promises";
import { useTestDatabase } from "./helpers.js";

useTestDatabase();
const { pool } = await import("../../src/db/pool.js");
await pool.query(await readFile(new URL("../../src/db/schema.sql", import.meta.url), "utf8"));
await pool.end();
console.log("Test database reset.");
