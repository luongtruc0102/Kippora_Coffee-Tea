-- Khách tại quầy có thể tích điểm bằng số điện thoại mà không cần tài khoản.
CREATE TABLE "PosCustomer" (
    "id" SERIAL NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PosCustomer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosCustomer_phone_key" ON "PosCustomer"("phone");

ALTER TABLE "Order" ADD COLUMN "posCustomerId" INTEGER;
CREATE INDEX "Order_posCustomerId_idx" ON "Order"("posCustomerId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_posCustomerId_fkey"
FOREIGN KEY ("posCustomerId") REFERENCES "PosCustomer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Xóa SĐT chi nhánh đã từng bị gán nhầm cho các hóa đơn khách lẻ POS cũ.
UPDATE "Order"
SET "receiverPhone" = ''
WHERE "channel" = 'POS' AND "receiverName" = 'Khách lẻ';
