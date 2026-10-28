// Creates (or re-creates) all tables from src/db/schema.sql.  Run: npm run db:setup
import { readFile } from "node:fs/promises";
import { pool } from "../src/db/pool.js";

const schema = await readFile(new URL("../src/db/schema.sql", import.meta.url), "utf8");
await pool.query(schema);
console.log("Database schema created.");
await pool.end();
