import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Supabase (direct + pooler hosts) only accepts TLS connections. Without SSL the
// server answers with a misleading "credentials are invalid" (28P01) error, so
// upgrade any Supabase host to encrypted connections automatically.
const { hostname } = new URL(databaseUrl);
const isSupabaseHost = hostname.endsWith(".pooler.supabase.com") || hostname.endsWith(".supabase.co");

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ...(isSupabaseHost ? { ssl: { rejectUnauthorized: false } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
