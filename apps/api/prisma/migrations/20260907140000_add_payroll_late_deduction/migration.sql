-- Lưu riêng khoản trừ tự động do đi trễ để kỳ đã chốt không bị tính lại theo quy tắc mới.
ALTER TABLE "StaffPayrollEntry"
ADD COLUMN "lateDeductionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
