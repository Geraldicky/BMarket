/*
  Warnings:

  - You are about to drop the column `isDisputed` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `offerId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `disputes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `offers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `recently_viewed` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wishlists` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[transactionId]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_openedById_fkey";

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_resolvedById_fkey";

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "offers" DROP CONSTRAINT "offers_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "offers" DROP CONSTRAINT "offers_chatRoomId_fkey";

-- DropForeignKey
ALTER TABLE "offers" DROP CONSTRAINT "offers_listingId_fkey";

-- DropForeignKey
ALTER TABLE "offers" DROP CONSTRAINT "offers_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "recently_viewed" DROP CONSTRAINT "recently_viewed_listingId_fkey";

-- DropForeignKey
ALTER TABLE "recently_viewed" DROP CONSTRAINT "recently_viewed_userId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_offerId_fkey";

-- DropForeignKey
ALTER TABLE "wishlists" DROP CONSTRAINT "wishlists_listingId_fkey";

-- DropForeignKey
ALTER TABLE "wishlists" DROP CONSTRAINT "wishlists_userId_fkey";

-- DropIndex
DROP INDEX "reviews_transactionId_reviewerId_key";

-- DropIndex
DROP INDEX "transactions_offerId_key";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "isDisputed",
DROP COLUMN "offerId";

-- DropTable
DROP TABLE "disputes";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "offers";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "recently_viewed";

-- DropTable
DROP TABLE "wishlists";

-- DropEnum
DROP TYPE "DisputeReason";

-- DropEnum
DROP TYPE "DisputeStatus";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "OfferStatus";

-- DropEnum
DROP TYPE "PaymentMethod";

-- DropEnum
DROP TYPE "PaymentStatus";

-- CreateIndex
CREATE UNIQUE INDEX "reviews_transactionId_key" ON "reviews"("transactionId");
