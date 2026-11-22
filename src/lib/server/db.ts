import "server-only";
import postgres from "postgres";

/**
 * Postgres connection. On Vercel use Supabase's transaction pooler (port 6543):
 * serverless functions open many short-lived connections, and prepared
 * statements don't survive transaction pooling, hence `prepare: false`.
 */

type Sql = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as { anylearnSql?: Sql };

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!globalForDb.anylearnSql) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    globalForDb.anylearnSql = postgres(url, {
      prepare: false,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: local ? false : "require",
    });
  }
  return globalForDb.anylearnSql;
}
