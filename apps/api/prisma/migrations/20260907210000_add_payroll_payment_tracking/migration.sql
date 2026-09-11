-- Kỳ lương có trạng thái thanh toán riêng sau khi Admin chốt số liệu.
ALTER TYPE "StaffPayrollStatus" ADD VALUE 'PAID';

CREATE TYPE "StaffPayrollPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER');

ALTER TABLE "StaffPayrollPeriod"
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paidById" INTEGER,
ADD COLUMN "paymentMethod" "StaffPayrollPaymentMethod",
ADD COLUMN "paymentReference" VARCHAR(100);

ALTER TABLE "StaffPayrollPeriod"
ADD CONSTRAINT "StaffPayrollPeriod_paidById_fkey"
FOREIGN KEY ("paidById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
