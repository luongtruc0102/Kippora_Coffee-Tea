-- Cấu hình hoạt động singleton của cửa hàng.
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "isAcceptingOrders" BOOLEAN NOT NULL DEFAULT true,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "openingTime" VARCHAR(5) NOT NULL DEFAULT '07:00',
    "closingTime" VARCHAR(5) NOT NULL DEFAULT '22:00',
    "preparationMinutes" INTEGER NOT NULL DEFAULT 20,
    "maxDeliveryDistanceKm" DECIMAL(6,2) NOT NULL DEFAULT 15,
    "pauseReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);