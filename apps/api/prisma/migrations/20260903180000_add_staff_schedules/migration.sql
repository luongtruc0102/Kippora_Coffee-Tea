CREATE TABLE "StaffShift" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(255),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StaffAttendance" ADD COLUMN "scheduledShiftId" INTEGER;

CREATE UNIQUE INDEX "StaffShift_employeeId_startAt_key" ON "StaffShift"("employeeId", "startAt");
CREATE INDEX "StaffShift_branchId_startAt_idx" ON "StaffShift"("branchId", "startAt");
CREATE INDEX "StaffShift_employeeId_startAt_endAt_idx" ON "StaffShift"("employeeId", "startAt", "endAt");
CREATE INDEX "StaffAttendance_scheduledShiftId_idx" ON "StaffAttendance"("scheduledShiftId");

ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_scheduledShiftId_fkey"
FOREIGN KEY ("scheduledShiftId") REFERENCES "StaffShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
