-- V23 Saved & Discovery
-- Replace any legacy/experimental saved-history tables with the canonical V23 shape.
-- These tables previously existed only in local experimental builds and were not part
-- of the V22 schema, so stale rows are intentionally discarded during this upgrade.
DROP TABLE IF EXISTS "wishlists" CASCADE;
DROP TABLE IF EXISTS "recently_viewed" CASCADE;

CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recently_viewed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recently_viewed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wishlists_userId_listingId_key" ON "wishlists"("userId", "listingId");
CREATE INDEX "wishlists_userId_createdAt_idx" ON "wishlists"("userId", "createdAt");
CREATE INDEX "wishlists_listingId_idx" ON "wishlists"("listingId");
CREATE UNIQUE INDEX "recently_viewed_userId_listingId_key" ON "recently_viewed"("userId", "listingId");
CREATE INDEX "recently_viewed_userId_viewedAt_idx" ON "recently_viewed"("userId", "viewedAt");
CREATE INDEX "recently_viewed_listingId_idx" ON "recently_viewed"("listingId");
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
