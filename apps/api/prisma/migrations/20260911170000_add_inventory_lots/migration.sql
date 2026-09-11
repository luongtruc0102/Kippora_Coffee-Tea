-- Quản lý lô nguyên liệu và hạn sử dụng nhưng vẫn giữ InventoryStock làm số dư tổng
-- để toàn bộ chức năng kho hiện tại tiếp tục tương thích.
CREATE TYPE "InventoryLotStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'DISPOSED');

ALTER TABLE "StockReceiptItem"
ADD COLUMN "batchCode" VARCHAR(80),
ADD COLUMN "manufacturedAt" DATE,
ADD COLUMN "expiresAt" DATE,
ADD COLUMN "lotNote" VARCHAR(255);

CREATE TABLE "InventoryLot" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "batchCode" VARCHAR(80),
    "branchId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "stockReceiptItemId" INTEGER,
    "manufacturedAt" DATE,
    "expiresAt" DATE,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "initialQuantity" DECIMAL(14,3) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "reservedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InventoryLotStatus" NOT NULL DEFAULT 'ACTIVE',
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "expiryNotifiedAt" TIMESTAMP(3),
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderIngredientLotAllocation" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "lotId" INTEGER NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "costAmount" DECIMAL(16,2) NOT NULL,
    "state" "InventoryState" NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderIngredientLotAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLotDisposal" (
    "id" SERIAL NOT NULL,
    "lotId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "quantity" DECIMAL(14,3) NOT NULL,
    "reason" "InventoryVarianceReason" NOT NULL,
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryLotDisposal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryMovement" ADD COLUMN "lotId" INTEGER;

CREATE UNIQUE INDEX "InventoryLot_code_key" ON "InventoryLot"("code");
CREATE INDEX "InventoryLot_branchId_expiresAt_idx" ON "InventoryLot"("branchId", "expiresAt");
CREATE INDEX "InventoryLot_ingredientId_expiresAt_idx" ON "InventoryLot"("ingredientId", "expiresAt");
CREATE INDEX "InventoryLot_stockReceiptItemId_idx" ON "InventoryLot"("stockReceiptItemId");
CREATE INDEX "InventoryLot_status_idx" ON "InventoryLot"("status");
CREATE UNIQUE INDEX "OrderIngredientLotAllocation_reservationId_lotId_key" ON "OrderIngredientLotAllocation"("reservationId", "lotId");
CREATE INDEX "OrderIngredientLotAllocation_orderId_idx" ON "OrderIngredientLotAllocation"("orderId");
CREATE INDEX "OrderIngredientLotAllocation_lotId_state_idx" ON "OrderIngredientLotAllocation"("lotId", "state");
CREATE INDEX "InventoryLotDisposal_lotId_createdAt_idx" ON "InventoryLotDisposal"("lotId", "createdAt");
CREATE INDEX "InventoryLotDisposal_branchId_createdAt_idx" ON "InventoryLotDisposal"("branchId", "createdAt");
CREATE INDEX "InventoryMovement_lotId_createdAt_idx" ON "InventoryMovement"("lotId", "createdAt");

ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_stockReceiptItemId_fkey" FOREIGN KEY ("stockReceiptItemId") REFERENCES "StockReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderIngredientLotAllocation" ADD CONSTRAINT "OrderIngredientLotAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderIngredientLotAllocation" ADD CONSTRAINT "OrderIngredientLotAllocation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "OrderIngredientReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderIngredientLotAllocation" ADD CONSTRAINT "OrderIngredientLotAllocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLotDisposal" ADD CONSTRAINT "InventoryLotDisposal_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLotDisposal" ADD CONSTRAINT "InventoryLotDisposal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLotDisposal" ADD CONSTRAINT "InventoryLotDisposal_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLotDisposal" ADD CONSTRAINT "InventoryLotDisposal_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mỗi số dư hiện có được chuyển thành một lô tồn đầu kỳ. Lô này không có hạn dùng
-- vì dữ liệu cũ chưa lưu thông tin bao bì, nhưng vẫn tham gia FEFO sau các lô có hạn.
INSERT INTO "InventoryLot" (
  "code", "batchCode", "branchId", "ingredientId", "receivedAt",
  "initialQuantity", "quantity", "reservedQuantity", "unitCost",
  "status", "isLegacy", "note", "createdAt", "updatedAt"
)
SELECT
  'LOT-OPEN-' || stock."id",
  'TỒN-ĐẦU-KỲ',
  stock."branchId",
  stock."ingredientId",
  CURRENT_TIMESTAMP,
  stock."quantity",
  stock."quantity",
  stock."reservedQuantity",
  COALESCE((
    SELECT item."unitCost"
    FROM "StockReceiptItem" item
    JOIN "StockReceipt" receipt ON receipt."id" = item."receiptId"
    WHERE receipt."branchId" = stock."branchId"
      AND item."ingredientId" = stock."ingredientId"
      AND receipt."status" = 'COMPLETED'
    ORDER BY COALESCE(receipt."receivedAt", receipt."createdAt") DESC
    LIMIT 1
  ), 0),
  CASE WHEN stock."quantity" <= 0 THEN 'DEPLETED'::"InventoryLotStatus" ELSE 'ACTIVE'::"InventoryLotStatus" END,
  true,
  'Tự động tạo khi nâng cấp quản lý lô; chưa có ngày sản xuất và hạn dùng.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "InventoryStock" stock;

-- Giữ nguyên các đơn đang đặt giữ kho bằng cách gắn lượng giữ vào lô đầu kỳ tương ứng.
INSERT INTO "OrderIngredientLotAllocation" (
  "orderId", "reservationId", "lotId", "quantity", "unitCost", "costAmount", "state", "createdAt", "updatedAt"
)
SELECT reservation."orderId", reservation."id", lot."id", reservation."quantity",
       lot."unitCost", reservation."quantity" * lot."unitCost", reservation."state",
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "OrderIngredientReservation" reservation
JOIN "Order" orders ON orders."id" = reservation."orderId"
JOIN "InventoryLot" lot ON lot."branchId" = orders."branchId"
  AND lot."ingredientId" = reservation."ingredientId" AND lot."isLegacy" = true
WHERE reservation."state" = 'RESERVED';

COMMENT ON TABLE "InventoryLot" IS 'Chi tiết từng lô nguyên liệu; InventoryStock là số dư tổng tương thích.';
COMMENT ON COLUMN "InventoryLot"."reservedQuantity" IS 'Lượng của riêng lô đang được giữ cho đơn chưa hoàn tất.';
COMMENT ON TABLE "OrderIngredientLotAllocation" IS 'Dấu vết FEFO nối đơn hàng, lượng giữ và lô nguyên liệu.';
COMMENT ON TABLE "InventoryLotDisposal" IS 'Biên bản hủy lô do hết hạn, hư hỏng, thất thoát hoặc lý do khác.';
