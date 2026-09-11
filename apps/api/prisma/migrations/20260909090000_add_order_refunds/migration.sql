-- Trạng thái thanh toán đã hoàn tiền được giữ riêng với giao dịch chưa thanh toán bị hủy.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

CREATE TYPE "RefundMethod" AS ENUM ('CASH', 'BANK_TRANSFER');

-- Sổ quỹ giữ ảnh chụp tiền hoàn theo phương thức để đối soát lại được từng ngày.
ALTER TABLE "CashSession"
ADD COLUMN "cashRefundAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
ADD COLUMN "bankRefundAmount" DECIMAL(16,2) NOT NULL DEFAULT 0;

CREATE TABLE "PaymentRefund" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "orderId" INTEGER NOT NULL,
  "paymentId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "amount" DECIMAL(16,2) NOT NULL,
  "method" "RefundMethod" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "processedById" INTEGER NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRefund_code_key" ON "PaymentRefund"("code");
CREATE UNIQUE INDEX "PaymentRefund_orderId_key" ON "PaymentRefund"("orderId");
CREATE UNIQUE INDEX "PaymentRefund_paymentId_key" ON "PaymentRefund"("paymentId");
CREATE INDEX "PaymentRefund_branchId_processedAt_idx" ON "PaymentRefund"("branchId", "processedAt");
CREATE INDEX "PaymentRefund_method_processedAt_idx" ON "PaymentRefund"("method", "processedAt");
CREATE INDEX "PaymentRefund_processedById_processedAt_idx" ON "PaymentRefund"("processedById", "processedAt");

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_processedById_fkey"
FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMENT ON TABLE "PaymentRefund" IS 'Chứng từ hoàn toàn bộ tiền, tạo nguyên tử cùng thao tác hủy đơn.';
COMMENT ON COLUMN "PaymentRefund"."amount" IS 'Số tiền lấy từ Payment tại backend; giao diện không được tự sửa.';
COMMENT ON COLUMN "PaymentRefund"."reason" IS 'Lý do bắt buộc phục vụ đối soát và kiểm toán.';
