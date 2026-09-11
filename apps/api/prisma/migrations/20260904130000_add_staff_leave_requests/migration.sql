CREATE TYPE "StaffLeaveType" AS ENUM ('PLANNED', 'EMERGENCY');
CREATE TYPE "StaffLeaveStatus" AS ENUM ('PENDING', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "StaffLeaveRequest" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "staffShiftId" INTEGER NOT NULL,
    "type" "StaffLeaveType" NOT NULL,
    "status" "StaffLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(500) NOT NULL,
    "evidenceUrl" VARCHAR(500),
    "reviewNote" VARCHAR(500),
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffLeaveRequest_employeeId_staffShiftId_key"
ON "StaffLeaveRequest"("employeeId", "staffShiftId");
CREATE INDEX "StaffLeaveRequest_branchId_status_createdAt_idx"
ON "StaffLeaveRequest"("branchId", "status", "createdAt");
CREATE INDEX "StaffLeaveRequest_employeeId_createdAt_idx"
ON "StaffLeaveRequest"("employeeId", "createdAt");
CREATE INDEX "StaffLeaveRequest_staffShiftId_idx"
ON "StaffLeaveRequest"("staffShiftId");

ALTER TABLE "StaffLeaveRequest"
ADD CONSTRAINT "StaffLeaveRequest_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffLeaveRequest"
ADD CONSTRAINT "StaffLeaveRequest_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffLeaveRequest"
ADD CONSTRAINT "StaffLeaveRequest_staffShiftId_fkey"
FOREIGN KEY ("staffShiftId") REFERENCES "StaffShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffLeaveRequest"
ADD CONSTRAINT "StaffLeaveRequest_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "StaffLeaveRequest" IS
'Yêu cầu nghỉ của nhân viên gắn với ca được xếp; hỗ trợ nghỉ báo trước, nghỉ đột xuất và lưu dấu vết duyệt.';
COMMENT ON COLUMN "StaffLeaveRequest"."evidenceUrl" IS
'Ảnh hoặc PDF minh chứng tùy chọn do nhân viên cung cấp, đặc biệt cho nghỉ đột xuất.';
COMMENT ON COLUMN "StaffLeaveRequest"."reviewNote" IS
'Phản hồi của trưởng chi nhánh khi duyệt, từ chối hoặc yêu cầu bổ sung.';
