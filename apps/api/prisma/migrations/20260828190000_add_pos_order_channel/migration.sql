-- Phân biệt đơn online và hóa đơn được tạo trực tiếp tại quầy POS.
CREATE TYPE "OrderChannel" AS ENUM ('ONLINE', 'POS');

ALTER TABLE "Order"
ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN "createdByStaffId" INTEGER;

CREATE INDEX "Order_channel_idx" ON "Order"("channel");
CREATE INDEX "Order_createdByStaffId_idx" ON "Order"("createdByStaffId");
