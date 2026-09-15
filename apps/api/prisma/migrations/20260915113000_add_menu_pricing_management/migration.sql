-- Chính sách định giá toàn hệ thống. Ba cột có default để dữ liệu StoreSettings hiện tại được nâng cấp an toàn.
ALTER TABLE "StoreSettings"
ADD COLUMN "pricingTargetMarginPercent" DECIMAL(5,2) NOT NULL DEFAULT 60,
ADD COLUMN "pricingCostAlertPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
ADD COLUMN "pricingRoundingStep" INTEGER NOT NULL DEFAULT 1000;

-- Lịch sử bất biến cho mỗi lần Admin áp dụng giá mới cho một size sản phẩm.
-- Các khóa ngoại nullable và ON DELETE SET NULL giúp giữ được chứng từ ngay cả khi dữ liệu gốc được dọn dẹp.
CREATE TABLE "ProductPriceHistory" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER,
    "variantId" INTEGER,
    "actorId" INTEGER,
    "costBasisBranchId" INTEGER,
    "productName" VARCHAR(160) NOT NULL,
    "variantSize" VARCHAR(30) NOT NULL,
    "oldPrice" DECIMAL(12,2) NOT NULL,
    "newPrice" DECIMAL(12,2) NOT NULL,
    "recipeCost" DECIMAL(14,2) NOT NULL,
    "targetMarginPercent" DECIMAL(5,2) NOT NULL,
    "costIncreasePercent" DECIMAL(8,2),
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductPriceHistory_productId_createdAt_idx" ON "ProductPriceHistory"("productId", "createdAt");
CREATE INDEX "ProductPriceHistory_variantId_createdAt_idx" ON "ProductPriceHistory"("variantId", "createdAt");
CREATE INDEX "ProductPriceHistory_actorId_createdAt_idx" ON "ProductPriceHistory"("actorId", "createdAt");
CREATE INDEX "ProductPriceHistory_costBasisBranchId_createdAt_idx" ON "ProductPriceHistory"("costBasisBranchId", "createdAt");

ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_costBasisBranchId_fkey"
FOREIGN KEY ("costBasisBranchId") REFERENCES "StoreBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
