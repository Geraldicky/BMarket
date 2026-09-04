-- Listing baru langsung tayang; moderasi dilakukan setelah ada laporan.
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'HIDDEN';
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'REMOVED';

ALTER TABLE "listings" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Listing lama yang masih menunggu persetujuan mengikuti flow post-moderation.
UPDATE "listings" SET "status" = 'ACTIVE' WHERE "status" = 'PENDING';

-- Sisakan satu laporan per pelapor/target sebelum constraint ditambahkan.
DELETE FROM "complaints" newer
USING "complaints" older
WHERE newer."reporterId" = older."reporterId"
  AND newer."targetType" = older."targetType"
  AND newer."targetId" = older."targetId"
  AND (
    newer."createdAt" > older."createdAt"
    OR (newer."createdAt" = older."createdAt" AND newer."id" > older."id")
  );

CREATE UNIQUE INDEX "complaints_reporterId_targetType_targetId_key"
ON "complaints"("reporterId", "targetType", "targetId");
