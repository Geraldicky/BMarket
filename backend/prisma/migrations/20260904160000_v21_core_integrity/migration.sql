-- V21 Core Stability & Transaction Integrity
-- 1) checkout reservation expiry
-- 2) immutable listing snapshot for transaction history

ALTER TABLE "transactions"
ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN "listingTitleSnapshot" TEXT,
ADD COLUMN "listingImageSnapshot" TEXT,
ADD COLUMN "listingTypeSnapshot" "ListingType",
ADD COLUMN "listingConditionSnapshot" "Condition";

-- Backfill snapshot for existing transactions without changing their current status.
UPDATE "transactions" AS t
SET
  "listingTitleSnapshot" = l."title",
  "listingImageSnapshot" = CASE
    WHEN l."images" IS NULL OR l."images" = '' OR l."images" = '[]' THEN NULL
    ELSE (l."images"::jsonb ->> 0)
  END,
  "listingTypeSnapshot" = l."type",
  "listingConditionSnapshot" = l."condition"
FROM "listings" AS l
WHERE t."listingId" = l."id";

-- Existing unpaid PENDING transactions receive the same 15-minute reservation rule.
UPDATE "transactions"
SET "reservationExpiresAt" = "createdAt" + INTERVAL '15 minutes'
WHERE "status" = 'PENDING' AND "reservationExpiresAt" IS NULL;

CREATE INDEX "transactions_status_reservationExpiresAt_idx"
ON "transactions"("status", "reservationExpiresAt");
