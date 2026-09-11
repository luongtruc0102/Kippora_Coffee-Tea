CREATE TYPE "StaffLeaveScope" AS ENUM ('FULL_SHIFT', 'EARLY_LEAVE');

ALTER TABLE "StaffLeaveRequest"
ADD COLUMN "scope" "StaffLeaveScope" NOT NULL DEFAULT 'FULL_SHIFT',
ADD COLUMN "requestedEndAt" TIMESTAMP(3);

ALTER TABLE "StaffPayrollEntry"
ADD COLUMN "unexcusedEarlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "earlyLeaveDeductionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
