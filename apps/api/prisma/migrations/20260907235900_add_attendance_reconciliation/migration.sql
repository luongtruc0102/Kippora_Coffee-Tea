CREATE TYPE "StaffAttendancePeriodStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'RETURNED');

CREATE TYPE "StaffAttendancePeriodAction" AS ENUM ('SUBMITTED', 'APPROVED', 'RETURNED', 'REOPENED');

CREATE TABLE "StaffAttendancePeriod" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "StaffAttendancePeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "submittedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "reviewNote" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendancePeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffAttendancePeriodEvent" (
    "id" SERIAL NOT NULL,
    "attendancePeriodId" INTEGER NOT NULL,
    "action" "StaffAttendancePeriodAction" NOT NULL,
    "fromStatus" "StaffAttendancePeriodStatus" NOT NULL,
    "toStatus" "StaffAttendancePeriodStatus" NOT NULL,
    "note" VARCHAR(500),
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAttendancePeriodEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StaffPayrollPeriod" ADD COLUMN "attendancePeriodId" INTEGER;

CREATE UNIQUE INDEX "StaffAttendancePeriod_branchId_periodStart_key" ON "StaffAttendancePeriod"("branchId", "periodStart");
CREATE INDEX "StaffAttendancePeriod_status_periodStart_idx" ON "StaffAttendancePeriod"("status", "periodStart");
CREATE INDEX "StaffAttendancePeriodEvent_attendancePeriodId_createdAt_idx" ON "StaffAttendancePeriodEvent"("attendancePeriodId", "createdAt");
CREATE INDEX "StaffAttendancePeriodEvent_actorId_idx" ON "StaffAttendancePeriodEvent"("actorId");
CREATE UNIQUE INDEX "StaffPayrollPeriod_attendancePeriodId_key" ON "StaffPayrollPeriod"("attendancePeriodId");

ALTER TABLE "StaffAttendancePeriod"
ADD CONSTRAINT "StaffAttendancePeriod_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffAttendancePeriod"
ADD CONSTRAINT "StaffAttendancePeriod_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffAttendancePeriod"
ADD CONSTRAINT "StaffAttendancePeriod_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffAttendancePeriodEvent"
ADD CONSTRAINT "StaffAttendancePeriodEvent_attendancePeriodId_fkey"
FOREIGN KEY ("attendancePeriodId") REFERENCES "StaffAttendancePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffAttendancePeriodEvent"
ADD CONSTRAINT "StaffAttendancePeriodEvent_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffPayrollPeriod"
ADD CONSTRAINT "StaffPayrollPeriod_attendancePeriodId_fkey"
FOREIGN KEY ("attendancePeriodId") REFERENCES "StaffAttendancePeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
