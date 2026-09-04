ALTER TABLE "chat_rooms" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "listings_status_createdAt_idx" ON "listings"("status", "createdAt");
CREATE INDEX "listings_category_status_idx" ON "listings"("category", "status");
CREATE INDEX "listings_sellerId_createdAt_idx" ON "listings"("sellerId", "createdAt");
CREATE INDEX "transactions_buyerId_createdAt_idx" ON "transactions"("buyerId", "createdAt");
CREATE INDEX "transactions_sellerId_createdAt_idx" ON "transactions"("sellerId", "createdAt");
CREATE INDEX "transactions_status_createdAt_idx" ON "transactions"("status", "createdAt");
CREATE INDEX "transactions_listingId_idx" ON "transactions"("listingId");
CREATE INDEX "reviews_revieweeId_createdAt_idx" ON "reviews"("revieweeId", "createdAt");
CREATE INDEX "chat_rooms_userAId_updatedAt_idx" ON "chat_rooms"("userAId", "updatedAt");
CREATE INDEX "chat_rooms_userBId_updatedAt_idx" ON "chat_rooms"("userBId", "updatedAt");
CREATE INDEX "messages_chatRoomId_createdAt_idx" ON "messages"("chatRoomId", "createdAt");
CREATE INDEX "messages_chatRoomId_isRead_senderId_idx" ON "messages"("chatRoomId", "isRead", "senderId");
CREATE INDEX "complaints_status_createdAt_idx" ON "complaints"("status", "createdAt");
CREATE INDEX "complaints_reporterId_createdAt_idx" ON "complaints"("reporterId", "createdAt");
CREATE INDEX "complaints_targetType_targetId_idx" ON "complaints"("targetType", "targetId");
