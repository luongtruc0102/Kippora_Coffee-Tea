-- Lưu các mốc phục vụ đo SLA và vòng đời hội thoại CSKH.
ALTER TABLE "SupportConversation"
ADD COLUMN "firstResponseAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "reopenedCount" INTEGER NOT NULL DEFAULT 0;

-- Khôi phục mốc phản hồi đầu tiên từ lịch sử tin nhắn hiện có.
UPDATE "SupportConversation" AS conversation
SET "firstResponseAt" = (
  SELECT MIN(message."createdAt")
  FROM "SupportMessage" AS message
  WHERE message."conversationId" = conversation."id"
    AND message."senderType" IN ('STAFF', 'ADMIN')
);

-- Hội thoại đã hoàn tất trước migration dùng updatedAt làm mốc gần đúng.
UPDATE "SupportConversation"
SET "resolvedAt" = "updatedAt"
WHERE "status" = 'RESOLVED';

CREATE INDEX "SupportConversation_branchId_createdAt_idx"
ON "SupportConversation"("branchId", "createdAt");

CREATE INDEX "SupportConversation_firstResponseAt_idx"
ON "SupportConversation"("firstResponseAt");
