-- Vòng đời đề xuất nhập hàng và đơn đặt nhà cung cấp.
CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'DRAFT',
  'PENDING',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED'
);

-- Một đơn đặt thuộc đúng một chi nhánh và một nhà cung cấp.
CREATE TABLE "PurchaseOrder" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "branchId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "createdById" INTEGER NOT NULL,
  "reviewedById" INTEGER,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "expectedAt" DATE,
  "note" VARCHAR(500),
  "reviewNote" VARCHAR(500),
  "totalCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "orderedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- Snapshot gợi ý, số lượng đặt, số đã nhận và đơn giá của từng nguyên liệu.
CREATE TABLE "PurchaseOrderItem" (
  "id" SERIAL NOT NULL,
  "purchaseOrderId" INTEGER NOT NULL,
  "ingredientId" INTEGER NOT NULL,
  "availableSnapshot" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "minimumLevelSnapshot" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "averageDailyUsage" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "incomingSnapshot" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "suggestedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "orderedQuantity" DECIMAL(14,3) NOT NULL,
  "receivedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(14,2) NOT NULL,
  "lineTotal" DECIMAL(16,2) NOT NULL,
  "note" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- Liên kết các phiếu nhập và dòng nhận hàng với đơn đặt nguồn.
ALTER TABLE "StockReceipt" ADD COLUMN "purchaseOrderId" INTEGER;
ALTER TABLE "StockReceiptItem" ADD COLUMN "purchaseOrderItemId" INTEGER;

CREATE UNIQUE INDEX "PurchaseOrder_code_key" ON "PurchaseOrder"("code");
CREATE INDEX "PurchaseOrder_branchId_createdAt_idx" ON "PurchaseOrder"("branchId", "createdAt");
CREATE INDEX "PurchaseOrder_supplierId_createdAt_idx" ON "PurchaseOrder"("supplierId", "createdAt");
CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "PurchaseOrder"("status", "createdAt");
CREATE INDEX "PurchaseOrder_createdById_createdAt_idx" ON "PurchaseOrder"("createdById", "createdAt");
CREATE UNIQUE INDEX "PurchaseOrderItem_purchaseOrderId_ingredientId_key" ON "PurchaseOrderItem"("purchaseOrderId", "ingredientId");
CREATE INDEX "PurchaseOrderItem_ingredientId_idx" ON "PurchaseOrderItem"("ingredientId");
CREATE INDEX "StockReceipt_purchaseOrderId_idx" ON "StockReceipt"("purchaseOrderId");
CREATE INDEX "StockReceiptItem_purchaseOrderItemId_idx" ON "StockReceiptItem"("purchaseOrderItemId");

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "PurchaseOrder" IS 'Đề xuất nhập hàng và đơn đặt nhà cung cấp; không tự cộng kho cho đến khi có lần nhận hàng.';
COMMENT ON COLUMN "PurchaseOrder"."expectedAt" IS 'Ngày giao dự kiến dùng để theo dõi đơn trễ giao.';
COMMENT ON COLUMN "PurchaseOrder"."totalCost" IS 'Giá trị dự kiến của toàn bộ số lượng đã đặt.';
COMMENT ON TABLE "PurchaseOrderItem" IS 'Chi tiết nguyên liệu; lưu snapshot căn cứ gợi ý và số nhận cộng dồn.';
COMMENT ON COLUMN "PurchaseOrderItem"."averageDailyUsage" IS 'Mức tiêu thụ trung bình mỗi ngày trong 14 ngày trước lúc lưu.';
COMMENT ON COLUMN "PurchaseOrderItem"."incomingSnapshot" IS 'Số lượng đang chờ giao từ các đơn mở khác tại lúc lưu.';
COMMENT ON COLUMN "PurchaseOrderItem"."suggestedQuantity" IS 'Số lượng hệ thống gợi ý để đạt ngưỡng và đủ dùng thêm 7 ngày.';
COMMENT ON COLUMN "PurchaseOrderItem"."receivedQuantity" IS 'Tổng số đã nhận từ mọi phiếu nhập liên kết với dòng đặt hàng.';
