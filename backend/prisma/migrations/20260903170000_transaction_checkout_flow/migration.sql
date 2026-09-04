-- Menyimpan histori milestone transaksi untuk timeline buyer/seller.
ALTER TABLE "transactions"
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledBy" TEXT,
ADD COLUMN "cancellationReason" TEXT;
