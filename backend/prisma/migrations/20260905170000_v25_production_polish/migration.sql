-- V25 Production Polish: notifications + wallet audit
-- Replace legacy notification experiments with the canonical V25 table.
DROP TABLE IF EXISTS "notifications" CASCADE;
DROP TABLE IF EXISTS "wallet_ledger" CASCADE;
DROP TYPE IF EXISTS "NotificationType" CASCADE;
DROP TYPE IF EXISTS "LedgerType" CASCADE;

CREATE TYPE "NotificationType" AS ENUM ('TRANSACTION','CHAT','REVIEW','DISPUTE','SYSTEM');
CREATE TYPE "LedgerType" AS ENUM ('TOPUP','PURCHASE_HOLD','REFUND','ESCROW_RELEASE','SELLER_PAYOUT');
CREATE TABLE "notifications" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "type" "NotificationType" NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "entityType" TEXT, "entityId" TEXT, "isRead" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId","isRead","createdAt");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "wallet_ledger" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "transactionId" TEXT, "type" "LedgerType" NOT NULL, "balanceDelta" DECIMAL(12,2) NOT NULL DEFAULT 0.00, "escrowDelta" DECIMAL(12,2) NOT NULL DEFAULT 0.00, "balanceAfter" DECIMAL(12,2) NOT NULL, "escrowAfter" DECIMAL(12,2) NOT NULL, "description" TEXT, "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wallet_ledger_idempotencyKey_key" ON "wallet_ledger"("idempotencyKey");
CREATE INDEX "wallet_ledger_userId_createdAt_idx" ON "wallet_ledger"("userId","createdAt");
CREATE INDEX "wallet_ledger_transactionId_idx" ON "wallet_ledger"("transactionId");
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
