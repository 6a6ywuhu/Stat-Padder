-- CreateIndex
CREATE INDEX "AttributeVote_createdAt_idx" ON "AttributeVote"("createdAt");

-- CreateIndex
CREATE INDEX "AttributeVote_playerId_createdAt_idx" ON "AttributeVote"("playerId", "createdAt");
