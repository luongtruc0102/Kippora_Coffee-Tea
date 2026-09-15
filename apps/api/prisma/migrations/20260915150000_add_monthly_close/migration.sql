-- CreateEnum
CREATE TYPE "MonthlyCloseStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MonthlyCloseEventType" AS ENUM ('CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "MonthlyClosePeriod" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "MonthlyCloseStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB,
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3),
    "closeNote" VARCHAR(500),
    "reopenedById" INTEGER,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyClosePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyCloseEvent" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "type" "MonthlyCloseEventType" NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "snapshot" JSONB,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyCloseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyClosePeriod_branchId_periodStart_key" ON "MonthlyClosePeriod"("branchId", "periodStart");
CREATE INDEX "MonthlyClosePeriod_status_periodStart_idx" ON "MonthlyClosePeriod"("status", "periodStart");
CREATE INDEX "MonthlyClosePeriod_closedById_closedAt_idx" ON "MonthlyClosePeriod"("closedById", "closedAt");
CREATE INDEX "MonthlyCloseEvent_periodId_createdAt_idx" ON "MonthlyCloseEvent"("periodId", "createdAt");
CREATE INDEX "MonthlyCloseEvent_actorId_createdAt_idx" ON "MonthlyCloseEvent"("actorId", "createdAt");
CREATE INDEX "MonthlyCloseEvent_type_createdAt_idx" ON "MonthlyCloseEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "MonthlyClosePeriod" ADD CONSTRAINT "MonthlyClosePeriod_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonthlyClosePeriod" ADD CONSTRAINT "MonthlyClosePeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyClosePeriod" ADD CONSTRAINT "MonthlyClosePeriod_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyCloseEvent" ADD CONSTRAINT "MonthlyCloseEvent_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "MonthlyClosePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyCloseEvent" ADD CONSTRAINT "MonthlyCloseEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "MonthlyClosePeriod" IS 'Trạng thái và snapshot chốt sổ tháng theo chi nhánh.';
COMMENT ON TABLE "MonthlyCloseEvent" IS 'Lịch sử bất biến của mọi lần chốt hoặc mở lại kỳ kế toán.';
COMMENT ON COLUMN "MonthlyClosePeriod"."snapshot" IS 'Ảnh chụp báo cáo tài chính tại lần chốt gần nhất.';
COMMENT ON COLUMN "MonthlyCloseEvent"."snapshot" IS 'Ảnh chụp báo cáo của đúng phiên bản chốt tương ứng.';
