-- CreateEnum
CREATE TYPE "ExpensePaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'PENDING_REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "CashSessionEventType" AS ENUM ('OPENED', 'CLOSED', 'APPROVED', 'REOPENED');

-- AlterTable
ALTER TABLE "BranchExpense"
ADD COLUMN "paymentMethod" "ExpensePaymentMethod" NOT NULL DEFAULT 'CASH';

-- CreateTable
CREATE TABLE "CashSession" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "branchId" INTEGER NOT NULL,
    "businessDate" DATE NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingFloat" DECIMAL(16,2) NOT NULL,
    "openingNote" VARCHAR(500),
    "openedById" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashSalesAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "bankSalesAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "cashExpenseAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "actualCash" DECIMAL(16,2),
    "difference" DECIMAL(16,2),
    "closingNote" VARCHAR(500),
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3),
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "reviewNote" VARCHAR(500),
    "reopenedById" INTEGER,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSessionEvent" (
    "id" SERIAL NOT NULL,
    "cashSessionId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "type" "CashSessionEventType" NOT NULL,
    "reason" VARCHAR(500),
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashSessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_code_key" ON "CashSession"("code");
CREATE UNIQUE INDEX "CashSession_branchId_businessDate_key" ON "CashSession"("branchId", "businessDate");
CREATE INDEX "CashSession_status_businessDate_idx" ON "CashSession"("status", "businessDate");
CREATE INDEX "CashSession_openedById_openedAt_idx" ON "CashSession"("openedById", "openedAt");
CREATE INDEX "CashSessionEvent_cashSessionId_createdAt_idx" ON "CashSessionEvent"("cashSessionId", "createdAt");
CREATE INDEX "CashSessionEvent_actorId_createdAt_idx" ON "CashSessionEvent"("actorId", "createdAt");
CREATE INDEX "CashSessionEvent_type_createdAt_idx" ON "CashSessionEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashSessionEvent" ADD CONSTRAINT "CashSessionEvent_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashSessionEvent" ADD CONSTRAINT "CashSessionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "CashSession" IS 'Sổ đối soát quỹ theo ngày và chi nhánh; trưởng chi nhánh đóng sổ, Admin duyệt và khóa.';
COMMENT ON COLUMN "CashSession"."businessDate" IS 'Ngày kinh doanh tại Việt Nam; duy nhất trong mỗi chi nhánh.';
COMMENT ON COLUMN "CashSession"."openingFloat" IS 'Tiền mặt có sẵn trong két lúc mở sổ.';
COMMENT ON COLUMN "CashSession"."cashSalesAmount" IS 'Tổng Payment COD đã PAID trong ngày kinh doanh.';
COMMENT ON COLUMN "CashSession"."bankSalesAmount" IS 'Tổng Payment BANK_TRANSFER đã PAID trong ngày để đối chiếu.';
COMMENT ON COLUMN "CashSession"."cashExpenseAmount" IS 'Tổng BranchExpense CASH đã APPROVED trong ngày.';
COMMENT ON COLUMN "CashSession"."expectedCash" IS 'Tiền dự kiến = quỹ đầu ngày + thu tiền mặt - chi tiền mặt.';
COMMENT ON COLUMN "CashSession"."difference" IS 'Chênh lệch = tiền kiểm đếm thực tế - tiền dự kiến.';
COMMENT ON TABLE "CashSessionEvent" IS 'Lịch sử bất biến của các lần mở, đóng, duyệt và mở lại sổ quỹ.';
COMMENT ON COLUMN "BranchExpense"."paymentMethod" IS 'CASH được tính vào dòng tiền két; BANK_TRANSFER không làm giảm tiền mặt.';
