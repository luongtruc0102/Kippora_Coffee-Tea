ALTER TABLE "StaffPayrollEntry"
ADD COLUMN "unexcusedAbsentSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "absenceDeductionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
