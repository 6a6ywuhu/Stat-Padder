-- CreateTable
CREATE TABLE "SocialAuth" (
    "channel" TEXT NOT NULL PRIMARY KEY,
    "accessToken" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "refreshedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
