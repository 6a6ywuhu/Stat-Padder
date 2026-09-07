/**
 * CLI entry point for the NHL data sync (spec section 12).
 * Usage: npm run sync [TEAM_ABBREV ...]
 */
import "dotenv/config";
import { runSync } from "../src/lib/sync-nhl-data";
import { prisma } from "../src/lib/prisma";

async function main() {
  const onlyAbbrevs = process.argv.slice(2);
  console.log(onlyAbbrevs.length ? `Syncing ${onlyAbbrevs.join(", ")}…` : "Syncing all 32 teams…");
  const result = await runSync(onlyAbbrevs);
  if (result.failedTeams.length) {
    console.error(`Failed to sync rosters for: ${result.failedTeams.join(", ")}`);
  }
  console.log(`Done. Synced ${result.teamsSynced} teams and ${result.playersSynced} players.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
