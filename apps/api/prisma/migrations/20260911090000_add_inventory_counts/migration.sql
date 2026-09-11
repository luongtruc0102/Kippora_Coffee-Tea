-- Vòng đời và nguyên nhân chênh lệch của phiếu kiểm kê kho.
CREATE TYPE "InventoryCountStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "InventoryVarianceReason" AS ENUM ('BREAKAGE', 'SPOILAGE', 'EXPIRED', 'LOSS', 'COUNTING_ERROR', 'OTHER');

-- Phiếu kiểm kê thuộc một chi nhánh, do nhân viên trưởng/Admin lập và Admin duyệt.
CREATE TABLE "InventoryCount" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "branchId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'DRAFT',
    "countedAt" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(500),
    "reviewNote" VARCHAR(500),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- Snapshot số hệ thống, số đếm và phần chênh lệch theo từng nguyên liệu.
CREATE TABLE "InventoryCountItem" (
    "id" SERIAL NOT NULL,
    "inventoryCountId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "expectedQuantity" DECIMAL(14,3) NOT NULL,
    "countedQuantity" DECIMAL(14,3) NOT NULL,
    "differenceQuantity" DECIMAL(14,3) NOT NULL,
    "reason" "InventoryVarianceReason",
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryCountItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryMovement" ADD COLUMN "inventoryCountId" INTEGER;

CREATE UNIQUE INDEX "InventoryCount_code_key" ON "InventoryCount"("code");
CREATE INDEX "InventoryCount_branchId_countedAt_idx" ON "InventoryCount"("branchId", "countedAt");
CREATE INDEX "InventoryCount_status_createdAt_idx" ON "InventoryCount"("status", "createdAt");
CREATE INDEX "InventoryCount_createdById_createdAt_idx" ON "InventoryCount"("createdById", "createdAt");
CREATE UNIQUE INDEX "InventoryCountItem_inventoryCountId_ingredientId_key" ON "InventoryCountItem"("inventoryCountId", "ingredientId");
CREATE INDEX "InventoryCountItem_ingredientId_idx" ON "InventoryCountItem"("ingredientId");
CREATE INDEX "InventoryMovement_inventoryCountId_idx" ON "InventoryMovement"("inventoryCountId");

ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "InventoryCount" IS 'Phiếu kiểm kê kho; chỉ trạng thái APPROVED mới làm thay đổi tồn thực tế.';
COMMENT ON COLUMN "InventoryCountItem"."expectedQuantity" IS 'Tồn hệ thống tại lúc lưu hoặc gửi phiếu.';
COMMENT ON COLUMN "InventoryCountItem"."countedQuantity" IS 'Số lượng vật lý được kiểm đếm.';
COMMENT ON COLUMN "InventoryCountItem"."differenceQuantity" IS 'Phần điều chỉnh được áp dụng khi Admin duyệt.';
