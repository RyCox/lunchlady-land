import "server-only";
import fs from "node:fs";
import path from "node:path";
import { seed } from "@/db/seed";

// A minimal query interface shared by PGlite (local, embedded) and node-postgres.
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
}

async function openPglite(dataDir: string | undefined): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  return {
    query: (sql, params) => pg.query(sql, params) as never,
    transaction: (fn) => pg.transaction((tx) => fn(tx as unknown as Queryable)),
    exec: async (sql) => {
      await pg.exec(sql);
    },
  };
}

async function openPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5 });
  return {
    query: (sql, params) => pool.query(sql, params as unknown[]) as never,
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(client as unknown as Queryable);
        await client.query("commit");
        return result;
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        client.release();
      }
    },
    exec: async (sql) => {
      await pool.query(sql);
    },
  };
}

async function migrate(db: Db) {
  const { rows } = await db.query<{ exists: boolean }>(
    "select to_regclass('public.schools') is not null as exists",
  );
  if (rows[0].exists) return;
  const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  await db.exec(schema);
  await db.transaction((tx) => seed(tx));
}

export async function openDb(opts: { url?: string; dataDir?: string; memory?: boolean } = {}) {
  const url = opts.url ?? process.env.DATABASE_URL;
  const db = url
    ? await openPostgres(url)
    : await openPglite(opts.memory ? undefined : (opts.dataDir ?? path.join(process.cwd(), ".data")));
  await migrate(db);
  return db;
}

const globalForDb = globalThis as unknown as { __lunchDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.__lunchDb ??= openDb();
  return globalForDb.__lunchDb;
}

/** Overrides the shared database (used by tests). */
export function setDb(db: Promise<Db>) {
  globalForDb.__lunchDb = db;
}

/**
 * Runs fn in a transaction tagged with the acting user, so the audit trigger
 * records who made each change. Pass amending to unlock a finalized record.
 */
export async function withTx<T>(
  userId: number,
  fn: (tx: Queryable) => Promise<T>,
  opts: { reason?: string; amending?: boolean } = {},
): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.query("select set_config('app.user_id', $1, true)", [String(userId)]);
    await tx.query("select set_config('app.reason', $1, true)", [opts.reason ?? ""]);
    await tx.query("select set_config('app.amending', $1, true)", [opts.amending ? "on" : ""]);
    return fn(tx);
  });
}
