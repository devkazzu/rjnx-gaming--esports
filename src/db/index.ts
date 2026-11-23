import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & { __rjnxPool?: Pool };

export const pool = globalForDb.__rjnxPool ?? new Pool({
  connectionString: databaseUrl,
  max: process.env.VERCEL === "1" ? 3 : 12,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
});

if (!globalForDb.__rjnxPool) {
  pool.on("error", () => console.error("[rjnx] idle PostgreSQL connection error"));
  globalForDb.__rjnxPool = pool;
}

export const db = drizzle(pool);
