-- Service deliverables: files a seller uploads as the result of a service transaction.
CREATE TABLE "transaction_deliverables" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_deliverables_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transaction_deliverables_transactionId_createdAt_idx" ON "transaction_deliverables"("transactionId", "createdAt");

ALTER TABLE "transaction_deliverables" ADD CONSTRAINT "transaction_deliverables_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transaction_deliverables" ADD CONSTRAINT "transaction_deliverables_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chat retention: messages older than 7 days are purged by createdAt.
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");
