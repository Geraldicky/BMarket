CREATE TYPE "DisputeReason" AS ENUM ('ITEM_NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'DAMAGED', 'SERVICE_ISSUE', 'PAYMENT_ISSUE', 'OTHER');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'REJECTED');

ALTER TABLE "transactions" ADD COLUMN "isDisputed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "disputes" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "openedById" TEXT NOT NULL,
  "reason" "DisputeReason" NOT NULL,
  "description" TEXT NOT NULL,
  "evidence" TEXT NOT NULL DEFAULT '[]',
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "refundAmount" DECIMAL(12,2),
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "disputes_transactionId_key" ON "disputes"("transactionId");
CREATE INDEX "disputes_status_createdAt_idx" ON "disputes"("status", "createdAt");
CREATE INDEX "disputes_openedById_createdAt_idx" ON "disputes"("openedById", "createdAt");
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
