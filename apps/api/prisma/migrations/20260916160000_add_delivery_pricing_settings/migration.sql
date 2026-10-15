-- Đưa công thức phí giao hàng đang cố định trong code về cấu hình database.
ALTER TABLE "StoreSettings"
ADD COLUMN "deliveryBaseDistanceKm" DECIMAL(6,2) NOT NULL DEFAULT 3,
ADD COLUMN "deliveryBaseFee" INTEGER NOT NULL DEFAULT 15000,
ADD COLUMN "deliveryFeePerKm" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN "deliveryDiscountFirstThreshold" INTEGER NOT NULL DEFAULT 300000,
ADD COLUMN "deliveryDiscountFirstAmount" INTEGER NOT NULL DEFAULT 20000,
ADD COLUMN "deliveryDiscountSecondThreshold" INTEGER NOT NULL DEFAULT 500000,
ADD COLUMN "deliveryDiscountSecondAmount" INTEGER NOT NULL DEFAULT 40000;
