/**
 * Shared PostgreSQL connection pool.
 *
 * A single pool instance is reused for the lifetime of the process.
 * Both the vector store and the catalog store call getPool() — they
 * will share the same underlying connections.
 *
 * Configuration (all via environment variables):
 *
 *   DATABASE_URL      — required when using the postgres provider
 *                       Format: postgresql://user:pass@host:port/dbname
 *                       Supabase:  found in Project Settings → Database → Connection string
 *                       AWS RDS:   standard PostgreSQL connection string
 *                       Append ?sslmode=require for Supabase / RDS
 *
 *   DATABASE_SSL      — "false" to disable SSL (local dev only).
 *                       Defaults to true (required for Supabase and RDS).
 *
 *   DATABASE_POOL_MAX — max open connections (default: 10).
 *                       Lower this on Supabase free tier (max 20 total).
 */

import pg from "pg";

const { Pool } = pg;

let _pool = null;

export function getPool() {
  if (_pool) {
    return _pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required when using the postgres provider. " +
        "Set it to your Supabase or RDS connection string.",
    );
  }

  const sslEnabled = process.env.DATABASE_SSL !== "false";
  _pool = new Pool({
    connectionString,
    // rejectUnauthorized: false allows self-signed certs (Supabase uses valid certs,
    // but this keeps local PG dev working without cert setup)
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  _pool.on("error", (err) => {
    console.error("[db/pool] Unexpected idle client error:", err.message);
  });

  return _pool;
}

/** Call on graceful shutdown to drain open connections. */
export async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
