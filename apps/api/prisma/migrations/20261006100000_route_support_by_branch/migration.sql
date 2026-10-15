ALTER TABLE "SupportConversation"
ADD COLUMN "branchId" INTEGER,
ADD COLUMN "relatedOrderId" INTEGER;

UPDATE "SupportConversation" AS conversation
SET
  "relatedOrderId" = (
    SELECT "id"
    FROM "Order"
    WHERE "userId" = conversation."customerId"
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT 1
  ),
  "branchId" = (
    SELECT "branchId"
    FROM "Order"
    WHERE "userId" = conversation."customerId"
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT 1
  );

UPDATE "SupportConversation"
SET "branchId" = (
  SELECT "id"
  FROM "StoreBranch"
  WHERE "isActive" = true
  ORDER BY "id" ASC
  LIMIT 1
)
WHERE "branchId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "SupportConversation" WHERE "branchId" IS NULL) THEN
    RAISE EXCEPTION 'Không thể phân tuyến hội thoại CSKH vì chưa có chi nhánh hoạt động';
  END IF;
END $$;

DROP INDEX IF EXISTS "SupportConversation_customerId_key";

ALTER TABLE "SupportConversation"
ALTER COLUMN "branchId" SET NOT NULL;

CREATE UNIQUE INDEX "SupportConversation_customerId_branchId_key"
ON "SupportConversation"("customerId", "branchId");

CREATE INDEX "SupportConversation_branchId_status_lastMessageAt_idx"
ON "SupportConversation"("branchId", "status", "lastMessageAt");

CREATE INDEX "SupportConversation_relatedOrderId_idx"
ON "SupportConversation"("relatedOrderId");

DROP INDEX IF EXISTS "SupportConversation_status_lastMessageAt_idx";

ALTER TABLE "SupportConversation"
ADD CONSTRAINT "SupportConversation_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupportConversation"
ADD CONSTRAINT "SupportConversation_relatedOrderId_fkey"
FOREIGN KEY ("relatedOrderId") REFERENCES "Order"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
