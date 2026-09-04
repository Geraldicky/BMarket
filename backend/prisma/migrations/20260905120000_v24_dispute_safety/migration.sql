-- V24 Dispute & Safety
-- Clean up names left by pre-V24 experimental migrations before creating the canonical models.
DROP TABLE IF EXISTS "disputes" CASCADE;
DROP TABLE IF EXISTS "user_blocks" CASCADE;
DROP TYPE IF EXISTS "DisputeResolution" CASCADE;
DROP TYPE IF EXISTS "DisputeStatus" CASCADE;
DROP TYPE IF EXISTS "DisputeReason" CASCADE;
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "isDisputed";

CREATE TYPE "DisputeReason" AS ENUM ('ITEM_NOT_AS_DESCRIBED','ITEM_DAMAGED','NOT_RECEIVED','SELLER_NO_SHOW','BUYER_NO_SHOW','OTHER');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN','IN_REVIEW','RESOLVED','REJECTED');
CREATE TYPE "DisputeResolution" AS ENUM ('REFUND_BUYER','RELEASE_SELLER','REJECT_DISPUTE');

CREATE TABLE "disputes" (
  "id" TEXT NOT NULL, "transactionId" TEXT NOT NULL, "openedById" TEXT NOT NULL,
  "reason" "DisputeReason" NOT NULL, "description" TEXT NOT NULL, "evidenceUrls" TEXT NOT NULL DEFAULT '[]',
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN', "resolution" "DisputeResolution", "resolutionNote" TEXT,
  "refundAmount" DECIMAL(12,2), "resolvedById" TEXT, "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "disputes_transactionId_key" ON "disputes"("transactionId");
CREATE INDEX "disputes_status_createdAt_idx" ON "disputes"("status","createdAt");
CREATE INDEX "disputes_openedById_createdAt_idx" ON "disputes"("openedById","createdAt");
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "user_blocks" (
  "id" TEXT NOT NULL, "blockerId" TEXT NOT NULL, "blockedId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId","blockedId");
CREATE INDEX "user_blocks_blockerId_createdAt_idx" ON "user_blocks"("blockerId","createdAt");
CREATE INDEX "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
