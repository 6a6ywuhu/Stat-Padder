-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "conference" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "logoLight" TEXT NOT NULL,
    "logoDark" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nhlId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "teamId" TEXT,
    "headshotUrl" TEXT,
    "heightInches" INTEGER,
    "weightPounds" INTEGER,
    "birthDate" TEXT,
    "birthCountry" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttributeVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "voterToken" TEXT NOT NULL,
    "voterHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttributeVote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "playerId" TEXT,
    "message" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Report_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_nhlId_key" ON "Player"("nhlId");

-- CreateIndex
CREATE INDEX "Player_position_idx" ON "Player"("position");

-- CreateIndex
CREATE INDEX "Player_status_idx" ON "Player"("status");

-- CreateIndex
CREATE INDEX "Player_lastName_idx" ON "Player"("lastName");

-- CreateIndex
CREATE INDEX "AttributeVote_playerId_attribute_idx" ON "AttributeVote"("playerId", "attribute");

-- CreateIndex
CREATE INDEX "AttributeVote_voterToken_playerId_attribute_idx" ON "AttributeVote"("voterToken", "playerId", "attribute");

-- CreateIndex
CREATE INDEX "AttributeVote_voterHash_createdAt_idx" ON "AttributeVote"("voterHash", "createdAt");

-- CreateIndex
CREATE INDEX "AttributeVote_createdAt_idx" ON "AttributeVote"("createdAt");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_type_idx" ON "Report"("type");
