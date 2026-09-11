ALTER TYPE "InventoryMovementType" ADD VALUE 'RECEIVE';

CREATE TYPE "StockReceiptStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Supplier" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "contactName" VARCHAR(100),
  "phone" VARCHAR(20),
  "email" VARCHAR(150),
  "address" VARCHAR(255),
  "note" VARCHAR(500),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

CREATE TABLE "StockReceipt" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "branchId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "createdById" INTEGER NOT NULL,
  "status" "StockReceiptStatus" NOT NULL DEFAULT 'DRAFT',
  "receivedAt" TIMESTAMP(3),
  "note" VARCHAR(500),
  "totalCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockReceipt_code_key" ON "StockReceipt"("code");
CREATE INDEX "StockReceipt_branchId_createdAt_idx" ON "StockReceipt"("branchId", "createdAt");
CREATE INDEX "StockReceipt_supplierId_createdAt_idx" ON "StockReceipt"("supplierId", "createdAt");
CREATE INDEX "StockReceipt_status_createdAt_idx" ON "StockReceipt"("status", "createdAt");

CREATE TABLE "StockReceiptItem" (
  "id" SERIAL NOT NULL,
  "receiptId" INTEGER NOT NULL,
  "ingredientId" INTEGER NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(14,2) NOT NULL,
  "lineTotal" DECIMAL(16,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockReceiptItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockReceiptItem_receiptId_ingredientId_key" ON "StockReceiptItem"("receiptId", "ingredientId");
CREATE INDEX "StockReceiptItem_ingredientId_idx" ON "StockReceiptItem"("ingredientId");

ALTER TABLE "InventoryMovement" ADD COLUMN "stockReceiptId" INTEGER;
CREATE INDEX "InventoryMovement_stockReceiptId_idx" ON "InventoryMovement"("stockReceiptId");

ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReceiptItem" ADD CONSTRAINT "StockReceiptItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_stockReceiptId_fkey" FOREIGN KEY ("stockReceiptId") REFERENCES "StockReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
