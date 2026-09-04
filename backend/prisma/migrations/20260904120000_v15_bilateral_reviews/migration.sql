DROP INDEX IF EXISTS "reviews_transactionId_key";
CREATE UNIQUE INDEX "reviews_transactionId_reviewerId_key" ON "reviews"("transactionId", "reviewerId");
