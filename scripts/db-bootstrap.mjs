import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "../src/config/loadEnv.js";
import { getPool, closePool } from "../src/db/pool.js";

loadEnvFile();

async function main() {
  const schemaPath = resolve(process.cwd(), "db/schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf8");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Set it before running db bootstrap.");
  }

  const pool = getPool();
  try {
    await pool.query(schemaSql);
    console.log("[db:bootstrap] Schema applied successfully.");
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error("[db:bootstrap] Failed:", error.message);
  process.exit(1);
});
