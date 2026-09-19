import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * Supabase Postgres connection options for postgres.js.
 *
 * - Remote hosts (including *.supabase.co / pooler) need TLS.
 * - Supabase's transaction pooler (port 6543 / *.pooler.supabase.com)
 *   does not support prepared statements, so prepare must be false there.
 * - Prefer the session/direct URL for `drizzle-kit migrate`; the pooler
 *   URL is fine for the app at runtime.
 */
function postgresOptions(url: string): Parameters<typeof postgres>[1] {
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const isPooler =
    url.includes("pooler.supabase.com") || /:6543(?:\/|\?|$)/.test(url);

  return {
    max: 10,
    ...(isLocal ? {} : { ssl: "require" as const }),
    ...(isPooler ? { prepare: false } : {}),
  };
}

// In development, Next's hot reload re-evaluates this module on every edit.
// Cache the postgres client on globalThis so we don't open a fresh pool of
// connections on every reload.
const globalForDb = globalThis as unknown as {
  __postgresClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__postgresClient ??
  postgres(env.DATABASE_URL, postgresOptions(env.DATABASE_URL));

if (process.env.NODE_ENV === "development") {
  globalForDb.__postgresClient = client;
}

export { client };
export const db = drizzle(client, { schema });
