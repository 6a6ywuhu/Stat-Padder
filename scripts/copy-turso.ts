/**
 * One-off: copy every row from one libSQL/Turso database to another with
 * the identical schema. Used to move off a region-locked Turso org.
 *
 *   SRC_URL=... SRC_TOKEN=... DST_URL=... DST_TOKEN=... npx tsx scripts/copy-turso.ts
 *
 * The destination must already have the schema (run scripts/migrate-libsql.ts
 * against it first, pointed there via TURSO_DATABASE_URL / TURSO_AUTH_TOKEN).
 * Tables are copied parent-first so foreign keys resolve; each table is
 * skipped if the destination already has rows in it, so it's safe to re-run.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) {
    console.error(`missing env ${k}`);
    process.exit(1);
  }
  return v;
};

const src = createClient({ url: need("SRC_URL"), authToken: need("SRC_TOKEN") });
const dst = createClient({ url: need("DST_URL"), authToken: need("DST_TOKEN") });

// Parent tables before children (FK order).
const TABLES = [
  "Team",
  "User",
  "Player",
  "Account",
  "Session",
  "VerificationToken",
  "AttributeVote",
  "Favorite",
  "Comment",
  "Report",
];

async function copyTable(name: string) {
  const existing = await dst.execute(`SELECT count(*) AS c FROM "${name}"`);
  if (Number(existing.rows[0].c) > 0) {
    console.log(`${name}: destination already has ${existing.rows[0].c} rows — skipped`);
    return;
  }

  const rows = (await src.execute(`SELECT * FROM "${name}"`)).rows;
  if (rows.length === 0) {
    console.log(`${name}: 0 rows`);
    return;
  }

  const cols = Object.keys(rows[0]);
  const placeholders = `(${cols.map(() => "?").join(", ")})`;
  const sql = `INSERT INTO "${name}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${placeholders}`;

  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map((r) => ({
      sql,
      args: cols.map((c) => (r as Record<string, unknown>)[c] as string | number | null),
    }));
    await dst.batch(batch, "write");
  }
  console.log(`${name}: copied ${rows.length} rows`);
}

async function main() {
  for (const t of TABLES) await copyTable(t);
  console.log("done.");
  src.close();
  dst.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
