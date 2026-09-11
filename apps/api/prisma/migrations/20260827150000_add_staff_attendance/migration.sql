CREATE TABLE "StaffAttendance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "recordedById" INTEGER,
    "clockIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOut" TIMESTAMP(3),
    "note" VARCHAR(255),
    "openKey" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffAttendance_openKey_key" ON "StaffAttendance"("openKey");
CREATE INDEX "StaffAttendance_branchId_clockIn_idx" ON "StaffAttendance"("branchId", "clockIn");
CREATE INDEX "StaffAttendance_employeeId_clockIn_idx" ON "StaffAttendance"("employeeId", "clockIn");

ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;