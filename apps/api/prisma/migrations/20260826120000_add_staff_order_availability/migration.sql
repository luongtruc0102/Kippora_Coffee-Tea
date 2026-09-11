-- Mỗi nhân viên có trạng thái trực riêng; không làm thay đổi StoreSettings toàn hệ thống.
ALTER TABLE "User"
ADD COLUMN "isAvailableForOrders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "staffPauseReason" VARCHAR(200);