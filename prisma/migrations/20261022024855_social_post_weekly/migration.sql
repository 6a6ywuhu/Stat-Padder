-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SocialPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'PLAYER',
    "playerId" TEXT,
    "weekStart" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'instagram',
    "scheduledFor" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "captionOverride" TEXT,
    "externalId" TEXT,
    "postedAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialPost_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SocialPost" ("captionOverride", "channel", "createdAt", "error", "externalId", "id", "playerId", "postedAt", "scheduledFor", "status", "updatedAt") SELECT "captionOverride", "channel", "createdAt", "error", "externalId", "id", "playerId", "postedAt", "scheduledFor", "status", "updatedAt" FROM "SocialPost";
DROP TABLE "SocialPost";
ALTER TABLE "new_SocialPost" RENAME TO "SocialPost";
CREATE INDEX "SocialPost_status_scheduledFor_idx" ON "SocialPost"("status", "scheduledFor");
CREATE INDEX "SocialPost_playerId_idx" ON "SocialPost"("playerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
