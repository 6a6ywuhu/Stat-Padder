/**
 * Applies the SQL migrations in prisma/migrations/ to a libSQL database.
 *
 * Prisma's own `migrate deploy` can't target a remote libSQL/Turso URL, so
 * this runs in its place on deploy (see netlify.toml). Migrations are still
 * *authored* with `npx prisma migrate dev` locally against the SQLite file;
 * this only replays the generated migration.sql files, in folder order,
 * skipping any it has already recorded in `_libsql_migrations`.
 *
 *   npx tsx scripts/migrate-libsql.ts
 *
 * Uses TURSO_DATABASE_URL + TURSO_AUTH_TOKEN when set, otherwise the local
 * file (prisma/dev.db) — same resolution as src/lib/prisma.ts.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

/** Split a migration file into individual statements: drop full-line `--`
 *  comments, then split on `;`. The Prisma-generated SQL has no procedural
 *  blocks or semicolons inside string literals, so this is safe here. */
function statements(sql: string): string[] {
  const stripped = sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS _libsql_migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  );

  const applied = new Set(
    (await db.execute("SELECT name FROM _libsql_migrations")).rows.map((r) => String(r.name))
  );

  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let ran = 0;
  for (const name of dirs) {
    if (applied.has(name)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
    const stmts = statements(sql);
    console.log(`Applying ${name} (${stmts.length} statements)…`);
    await db.batch([...stmts, { sql: "INSERT INTO _libsql_migrations (name) VALUES (?)", args: [name] }], "write");
    ran++;
  }

  console.log(ran === 0 ? "No pending migrations." : `Applied ${ran} migration(s).`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
