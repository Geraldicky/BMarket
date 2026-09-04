-- V12: metode penyerahan, ongkir simulasi, dan verifikasi serah-terima.
CREATE TYPE "FulfillmentMethod" AS ENUM ('CAMPUS_MEETUP', 'INSTANT_COURIER');
CREATE TYPE "CourierProvider" AS ENUM ('GOSEND', 'GRABEXPRESS');

ALTER TABLE "listings"
ADD COLUMN "fulfillmentMethods" "FulfillmentMethod"[] NOT NULL
DEFAULT ARRAY['CAMPUS_MEETUP', 'INSTANT_COURIER']::"FulfillmentMethod"[];

ALTER TABLE "transactions"
ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'CAMPUS_MEETUP',
ADD COLUMN "meetupCampus" TEXT,
ADD COLUMN "meetupLocation" TEXT,
ADD COLUMN "meetupSchedule" TEXT,
ADD COLUMN "courierProvider" "CourierProvider",
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "recipientPhone" TEXT,
ADD COLUMN "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "trackingNumber" TEXT,
ADD COLUMN "handoverCodeHash" TEXT,
ADD COLUMN "handoverCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN "handoverVerifiedAt" TIMESTAMP(3);

UPDATE "transactions" SET "grandTotal" = "totalPrice";

CREATE INDEX "transactions_fulfillmentMethod_status_idx"
ON "transactions"("fulfillmentMethod", "status");
