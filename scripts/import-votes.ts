/**
 * One-off: carry the AttributeVote rows from the old Neon database into the
 * new libSQL/Turso one. Run AFTER `npm run sync` has re-seeded players on
 * the target (the sync generates fresh Player ids, so votes are remapped by
 * the stable `nhlId`, not the old cuid).
 *
 *   npx tsx scripts/import-votes.ts <neon-export.json>
 *
 * The export file is produced from Neon with:
 *   SELECT id, "nhlId" FROM "Player";           -> players[]
 *   SELECT * FROM "AttributeVote";              -> votes[]
 * shaped as { players: [{id,nhlId}], votes: [{playerId,attribute,value,
 * voterToken,voterHash,userId,createdAt,id}] }.
 *
 * Target DB resolves the same as the app: TURSO_DATABASE_URL +
 * TURSO_AUTH_TOKEN, else the local file. Skips any vote whose player can't
 * be matched, and any vote id already present (safe to re-run).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const exportPath = process.argv[2];
if (!exportPath) {
  console.error("usage: npx tsx scripts/import-votes.ts <neon-export.json>");
  process.exit(1);
}

const { players, votes } = JSON.parse(readFileSync(exportPath, "utf8")) as {
  players: { id: string; nhlId: number }[];
  votes: {
    id: string;
    playerId: string;
    attribute: string;
    value: number;
    voterToken: string;
    voterHash: string;
    userId: string | null;
    createdAt: string;
  }[];
};

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./prisma/dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function main() {
  const oldIdToNhlId = new Map(players.map((p) => [p.id, p.nhlId]));

  const targetPlayers = await db.execute("SELECT id, nhlId FROM Player");
  const nhlIdToNewId = new Map(targetPlayers.rows.map((r) => [Number(r.nhlId), String(r.id)]));

  const existing = new Set(
    (await db.execute("SELECT id FROM AttributeVote")).rows.map((r) => String(r.id))
  );

  let inserted = 0;
  let skippedNoPlayer = 0;
  let skippedDup = 0;
  const batch: { sql: string; args: (string | number | null)[] }[] = [];

  for (const v of votes) {
    if (existing.has(v.id)) {
      skippedDup++;
      continue;
    }
    const nhlId = oldIdToNhlId.get(v.playerId);
    const newPlayerId = nhlId != null ? nhlIdToNewId.get(nhlId) : undefined;
    if (!newPlayerId) {
      skippedNoPlayer++;
      continue;
    }
    batch.push({
      sql: `INSERT INTO AttributeVote (id, playerId, attribute, value, voterToken, voterHash, userId, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      // userId dropped — the old DB had no users; a stale id would break the FK.
      args: [v.id, newPlayerId, v.attribute, v.value, v.voterToken, v.voterHash, null, v.createdAt],
    });
    inserted++;
  }

  if (batch.length) await db.batch(batch, "write");

  console.log(
    `imported ${inserted} votes; skipped ${skippedDup} already present, ${skippedNoPlayer} with no matching player`
  );
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
