import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * The pool is created lazily on first use, NOT at module load time.
 *
 * Next.js evaluates route/page modules during `next build` (page data
 * collection) on Vercel, where DATABASE_URL may not be present in the build
 * environment. Throwing here would break the whole build, so we defer both
 * the validation and the Pool construction until the first actual query.
 */

type DbPool = ReturnType<typeof drizzle>;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: DbPool;
};

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  // Supabase (direct + pooler hosts) only accepts TLS connections. Without SSL the
  // server answers with a misleading "credentials are invalid" (28P01) error, so
  // upgrade any Supabase host to encrypted connections automatically.
  const { hostname } = new URL(databaseUrl);
  const isSupabaseHost =
    hostname.endsWith(".pooler.supabase.com") || hostname.endsWith(".supabase.co");

  return new Pool({
    connectionString: databaseUrl,
    ...(isSupabaseHost ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

function getPool(): Pool {
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = createPool();
  }
  return globalForDb.__arenaNextJsPostgresqlPool;
}

function getDb(): DbPool {
  if (!globalForDb.__arenaNextJsPostgresqlDb) {
    globalForDb.__arenaNextJsPostgresqlDb = drizzle(getPool());
  }
  return globalForDb.__arenaNextJsPostgresqlDb;
}

/**
 * Lazily-initialized Drizzle instance. A Proxy keeps `import { db } from "@/db"`
 * working exactly as before without triggering Pool creation at import time.
 */
export const db = new Proxy({} as DbPool, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

/** Exposed for graceful shutdown / cleanup if ever needed. */
export function getPoolInstance(): Pool {
  return getPool();
}
