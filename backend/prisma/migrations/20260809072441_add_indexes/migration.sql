-- CreateIndex
CREATE INDEX "Article_feedId_publishedAt_idx" ON "Article"("feedId", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");

-- CreateIndex
CREATE INDEX "Article_isRead_idx" ON "Article"("isRead");

-- CreateIndex
CREATE INDEX "Article_isStarred_idx" ON "Article"("isStarred");

-- CreateIndex
CREATE INDEX "Feed_enabled_idx" ON "Feed"("enabled");

-- CreateIndex
CREATE INDEX "Feed_createdAt_idx" ON "Feed"("createdAt");
