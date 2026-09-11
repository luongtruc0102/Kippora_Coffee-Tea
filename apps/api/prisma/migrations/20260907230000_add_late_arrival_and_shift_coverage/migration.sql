-- Mở rộng đơn xin phép để nhân viên khai giờ dự kiến đến trễ.
ALTER TYPE "StaffLeaveScope" ADD VALUE 'LATE_ARRIVAL';

ALTER TABLE "StaffLeaveRequest"
ADD COLUMN "requestedStartAt" TIMESTAMP(3);

-- Trạng thái xác nhận của người được trưởng chi nhánh phân công làm thay.
CREATE TYPE "StaffShiftCoverageStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'COMPLETED',
  'CANCELLED'
);

-- Lưu riêng phân công làm thay để theo dõi người phân công, người nhận và thời gian thực tế.
CREATE TABLE "StaffShiftCoverage" (
  "id" SERIAL NOT NULL,
  "leaveRequestId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "coveringEmployeeId" INTEGER NOT NULL,
  "assignedById" INTEGER NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "actualEndAt" TIMESTAMP(3),
  "status" "StaffShiftCoverageStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffShiftCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffShiftCoverage_leaveRequestId_key"
ON "StaffShiftCoverage"("leaveRequestId");

CREATE INDEX "StaffShiftCoverage_branchId_status_startAt_idx"
ON "StaffShiftCoverage"("branchId", "status", "startAt");

CREATE INDEX "StaffShiftCoverage_coveringEmployeeId_status_startAt_idx"
ON "StaffShiftCoverage"("coveringEmployeeId", "status", "startAt");

ALTER TABLE "StaffShiftCoverage"
ADD CONSTRAINT "StaffShiftCoverage_leaveRequestId_fkey"
FOREIGN KEY ("leaveRequestId") REFERENCES "StaffLeaveRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffShiftCoverage"
ADD CONSTRAINT "StaffShiftCoverage_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffShiftCoverage"
ADD CONSTRAINT "StaffShiftCoverage_coveringEmployeeId_fkey"
FOREIGN KEY ("coveringEmployeeId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffShiftCoverage"
ADD CONSTRAINT "StaffShiftCoverage_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
