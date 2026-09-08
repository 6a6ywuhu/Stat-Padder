/*
  Warnings:

  - Added the required column `localDay` to the `AttributeVote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `submissionId` to the `AttributeVote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `voterKey` to the `AttributeVote` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AttributeVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "submissionId" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "voterToken" TEXT NOT NULL,
    "voterHash" TEXT NOT NULL,
    "userId" TEXT,
    "localDay" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttributeVote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttributeVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AttributeVote" ("attribute", "createdAt", "id", "playerId", "userId", "value", "voterHash", "voterToken") SELECT "attribute", "createdAt", "id", "playerId", "userId", "value", "voterHash", "voterToken" FROM "AttributeVote";
DROP TABLE "AttributeVote";
ALTER TABLE "new_AttributeVote" RENAME TO "AttributeVote";
CREATE INDEX "AttributeVote_playerId_attribute_idx" ON "AttributeVote"("playerId", "attribute");
CREATE INDEX "AttributeVote_playerId_voterKey_idx" ON "AttributeVote"("playerId", "voterKey");
CREATE INDEX "AttributeVote_voterToken_idx" ON "AttributeVote"("voterToken");
CREATE INDEX "AttributeVote_userId_playerId_idx" ON "AttributeVote"("userId", "playerId");
CREATE INDEX "AttributeVote_submissionId_idx" ON "AttributeVote"("submissionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
