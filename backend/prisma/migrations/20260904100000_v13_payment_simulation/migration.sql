CREATE TYPE "PaymentMethod" AS ENUM ('BMARKET_BALANCE', 'QRIS', 'VIRTUAL_ACCOUNT', 'E_WALLET');
CREATE TYPE "PaymentStatus" AS ENUM ('WAITING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED');

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "provider" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'WAITING',
  "amount" DECIMAL(12,2) NOT NULL,
  "reference" TEXT NOT NULL,
  "virtualAccount" TEXT,
  "qrPayload" TEXT,
  "expiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");
CREATE INDEX "payments_status_expiresAt_idx" ON "payments"("status", "expiresAt");
CREATE INDEX "payments_method_createdAt_idx" ON "payments"("method", "createdAt");
ALTER TABLE "payments" ADD CONSTRAINT "payments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
