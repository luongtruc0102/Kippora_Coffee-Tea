-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'UTILITIES', 'MAINTENANCE', 'MARKETING', 'SUPPLIES', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BranchExpense" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "branchId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "incurredOn" DATE NOT NULL,
    "description" VARCHAR(180) NOT NULL,
    "note" VARCHAR(500),
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchExpense_code_key" ON "BranchExpense"("code");
CREATE INDEX "BranchExpense_branchId_incurredOn_idx" ON "BranchExpense"("branchId", "incurredOn");
CREATE INDEX "BranchExpense_status_submittedAt_idx" ON "BranchExpense"("status", "submittedAt");
CREATE INDEX "BranchExpense_category_incurredOn_idx" ON "BranchExpense"("category", "incurredOn");
CREATE INDEX "BranchExpense_createdById_createdAt_idx" ON "BranchExpense"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "BranchExpense" ADD CONSTRAINT "BranchExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchExpense" ADD CONSTRAINT "BranchExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchExpense" ADD CONSTRAINT "BranchExpense_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "BranchExpense" IS 'Khoản chi vận hành theo chi nhánh; trưởng chi nhánh lập và Admin duyệt, không xóa vật lý để giữ lịch sử.';
COMMENT ON COLUMN "BranchExpense"."code" IS 'Mã chứng từ hiển thị dạng CP-YYYYMM-ID.';
COMMENT ON COLUMN "BranchExpense"."incurredOn" IS 'Ngày chi phí thực tế phát sinh, dùng cho báo cáo lợi nhuận.';
COMMENT ON COLUMN "BranchExpense"."status" IS 'DRAFT: nháp; PENDING: chờ Admin; APPROVED/REJECTED: kết quả duyệt; CANCELLED: người lập hủy trước khi gửi.';
COMMENT ON COLUMN "BranchExpense"."reviewNote" IS 'Lý do từ chối hoặc ghi chú đối soát của Admin.';
