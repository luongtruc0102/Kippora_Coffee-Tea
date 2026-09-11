CREATE TYPE "InventoryState" AS ENUM ('NOT_TRACKED', 'RESERVED', 'CONSUMED', 'RELEASED');
CREATE TYPE "IngredientUnit" AS ENUM ('GRAM', 'MILLILITER', 'PIECE');
CREATE TYPE "InventoryMovementType" AS ENUM ('ADJUST', 'RESERVE', 'RELEASE', 'CONSUME');

ALTER TABLE "Order" ADD COLUMN "inventoryState" "InventoryState" NOT NULL DEFAULT 'NOT_TRACKED';

CREATE TABLE "Ingredient" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "unit" "IngredientUnit" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

CREATE TABLE "InventoryStock" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "ingredientId" INTEGER NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "reservedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "minimumLevel" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "lowStockNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryStock_branchId_ingredientId_key" ON "InventoryStock"("branchId", "ingredientId");
CREATE INDEX "InventoryStock_ingredientId_idx" ON "InventoryStock"("ingredientId");

CREATE TABLE "VariantRecipeIngredient" (
  "id" SERIAL NOT NULL, "variantId" INTEGER NOT NULL, "ingredientId" INTEGER NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL, CONSTRAINT "VariantRecipeIngredient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VariantRecipeIngredient_variantId_ingredientId_key" ON "VariantRecipeIngredient"("variantId", "ingredientId");
CREATE INDEX "VariantRecipeIngredient_ingredientId_idx" ON "VariantRecipeIngredient"("ingredientId");

CREATE TABLE "ToppingRecipeIngredient" (
  "id" SERIAL NOT NULL, "toppingId" INTEGER NOT NULL, "ingredientId" INTEGER NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL, CONSTRAINT "ToppingRecipeIngredient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ToppingRecipeIngredient_toppingId_ingredientId_key" ON "ToppingRecipeIngredient"("toppingId", "ingredientId");
CREATE INDEX "ToppingRecipeIngredient_ingredientId_idx" ON "ToppingRecipeIngredient"("ingredientId");

CREATE TABLE "OrderItemRecipeIngredient" (
  "id" SERIAL NOT NULL, "orderItemId" INTEGER NOT NULL, "ingredientId" INTEGER,
  "ingredientName" VARCHAR(120) NOT NULL, "unit" "IngredientUnit" NOT NULL,
  "sourceName" VARCHAR(120) NOT NULL, "quantityPerItem" DECIMAL(14,3) NOT NULL,
  "totalQuantity" DECIMAL(14,3) NOT NULL, CONSTRAINT "OrderItemRecipeIngredient_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderItemRecipeIngredient_orderItemId_idx" ON "OrderItemRecipeIngredient"("orderItemId");
CREATE INDEX "OrderItemRecipeIngredient_ingredientId_idx" ON "OrderItemRecipeIngredient"("ingredientId");

CREATE TABLE "OrderIngredientReservation" (
  "id" SERIAL NOT NULL, "orderId" INTEGER NOT NULL, "ingredientId" INTEGER NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL, "state" "InventoryState" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderIngredientReservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderIngredientReservation_orderId_ingredientId_key" ON "OrderIngredientReservation"("orderId", "ingredientId");
CREATE INDEX "OrderIngredientReservation_ingredientId_idx" ON "OrderIngredientReservation"("ingredientId");

CREATE TABLE "InventoryMovement" (
  "id" SERIAL NOT NULL, "branchId" INTEGER NOT NULL, "ingredientId" INTEGER NOT NULL,
  "orderId" INTEGER, "actorId" INTEGER, "type" "InventoryMovementType" NOT NULL,
  "quantityDelta" DECIMAL(14,3) NOT NULL, "reservedDelta" DECIMAL(14,3) NOT NULL,
  "quantityAfter" DECIMAL(14,3) NOT NULL, "reservedAfter" DECIMAL(14,3) NOT NULL,
  "note" VARCHAR(255), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InventoryMovement_branchId_createdAt_idx" ON "InventoryMovement"("branchId", "createdAt");
CREATE INDEX "InventoryMovement_ingredientId_createdAt_idx" ON "InventoryMovement"("ingredientId", "createdAt");
CREATE INDEX "InventoryMovement_orderId_idx" ON "InventoryMovement"("orderId");

ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VariantRecipeIngredient" ADD CONSTRAINT "VariantRecipeIngredient_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VariantRecipeIngredient" ADD CONSTRAINT "VariantRecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ToppingRecipeIngredient" ADD CONSTRAINT "ToppingRecipeIngredient_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "Topping"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToppingRecipeIngredient" ADD CONSTRAINT "ToppingRecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItemRecipeIngredient" ADD CONSTRAINT "OrderItemRecipeIngredient_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemRecipeIngredient" ADD CONSTRAINT "OrderItemRecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderIngredientReservation" ADD CONSTRAINT "OrderIngredientReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderIngredientReservation" ADD CONSTRAINT "OrderIngredientReservation_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
