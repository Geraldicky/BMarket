CREATE TYPE "PaymentProvider" AS ENUM ('MIDTRANS');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SETTLED', 'FAILED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MIDTRANS',
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "snapToken" TEXT,
    "redirectUrl" TEXT,
    "paymentType" TEXT,
    "providerStatus" TEXT,
    "providerTransactionId" TEXT,
    "fraudStatus" TEXT,
    "expiresAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "refundRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");
CREATE INDEX "payments_transactionId_createdAt_idx" ON "payments"("transactionId", "createdAt");
CREATE INDEX "payments_transactionId_status_idx" ON "payments"("transactionId", "status");
CREATE UNIQUE INDEX "payments_one_pending_per_transaction" ON "payments"("transactionId") WHERE "status" = 'PENDING';

ALTER TABLE "payments" ADD CONSTRAINT "payments_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
