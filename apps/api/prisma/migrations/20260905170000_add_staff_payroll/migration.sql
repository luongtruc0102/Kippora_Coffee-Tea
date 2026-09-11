-- Quản lý lương theo giờ, tách theo kỳ tháng và chi nhánh.
-- Kỳ nháp đồng bộ từ bảng công; kỳ đã chốt giữ nguyên snapshot phục vụ đối soát.

CREATE TYPE "StaffPayrollStatus" AS ENUM ('DRAFT', 'FINALIZED');
CREATE TYPE "StaffPayrollAdjustmentType" AS ENUM ('BONUS', 'DEDUCTION');

ALTER TABLE "StaffProfile"
  ADD COLUMN "hourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 32000,
  ADD COLUMN "overtimeMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5;

CREATE TABLE "StaffPayrollPeriod" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "status" "StaffPayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "finalizedAt" TIMESTAMP(3),
  "finalizedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffPayrollPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffPayrollEntry" (
  "id" SERIAL NOT NULL,
  "payrollPeriodId" INTEGER NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "hourlyRateSnapshot" DECIMAL(12,2) NOT NULL,
  "overtimeMultiplierSnapshot" DECIMAL(4,2) NOT NULL,
  "regularSeconds" INTEGER NOT NULL DEFAULT 0,
  "overtimeSeconds" INTEGER NOT NULL DEFAULT 0,
  "scheduledShifts" INTEGER NOT NULL DEFAULT 0,
  "completedShifts" INTEGER NOT NULL DEFAULT 0,
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
  "absentShifts" INTEGER NOT NULL DEFAULT 0,
  "excusedLeaveShifts" INTEGER NOT NULL DEFAULT 0,
  "baseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "overtimeAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "bonusAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "deductionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffPayrollEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffPayrollAdjustment" (
  "id" SERIAL NOT NULL,
  "payrollEntryId" INTEGER NOT NULL,
  "type" "StaffPayrollAdjustmentType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" VARCHAR(255) NOT NULL,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffPayrollAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffPayrollPeriod_branchId_periodStart_key"
  ON "StaffPayrollPeriod"("branchId", "periodStart");
CREATE INDEX "StaffPayrollPeriod_status_periodStart_idx"
  ON "StaffPayrollPeriod"("status", "periodStart");
CREATE UNIQUE INDEX "StaffPayrollEntry_payrollPeriodId_employeeId_key"
  ON "StaffPayrollEntry"("payrollPeriodId", "employeeId");
CREATE INDEX "StaffPayrollEntry_employeeId_idx"
  ON "StaffPayrollEntry"("employeeId");
CREATE INDEX "StaffPayrollAdjustment_payrollEntryId_createdAt_idx"
  ON "StaffPayrollAdjustment"("payrollEntryId", "createdAt");

ALTER TABLE "StaffPayrollPeriod"
  ADD CONSTRAINT "StaffPayrollPeriod_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffPayrollPeriod"
  ADD CONSTRAINT "StaffPayrollPeriod_finalizedById_fkey"
  FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffPayrollEntry"
  ADD CONSTRAINT "StaffPayrollEntry_payrollPeriodId_fkey"
  FOREIGN KEY ("payrollPeriodId") REFERENCES "StaffPayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffPayrollEntry"
  ADD CONSTRAINT "StaffPayrollEntry_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffPayrollAdjustment"
  ADD CONSTRAINT "StaffPayrollAdjustment_payrollEntryId_fkey"
  FOREIGN KEY ("payrollEntryId") REFERENCES "StaffPayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffPayrollAdjustment"
  ADD CONSTRAINT "StaffPayrollAdjustment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON COLUMN "StaffProfile"."hourlyRate" IS
'Đơn giá một giờ làm hiện tại; mặc định 32.000 đồng và được chụp vào từng kỳ lương.';
COMMENT ON COLUMN "StaffProfile"."overtimeMultiplier" IS
'Hệ số tăng ca hiện tại; mặc định 1,5 lần đơn giá giờ.';
COMMENT ON TABLE "StaffPayrollPeriod" IS
'Kỳ lương tháng của một chi nhánh; FINALIZED khóa toàn bộ snapshot và khoản điều chỉnh.';
COMMENT ON TABLE "StaffPayrollEntry" IS
'Dòng lương snapshot theo nhân viên, gồm giờ thường, tăng ca, thống kê ca và tổng tiền.';
COMMENT ON TABLE "StaffPayrollAdjustment" IS
'Khoản thưởng hoặc khấu trừ thủ công có người tạo, số tiền và lý do để truy vết.';
