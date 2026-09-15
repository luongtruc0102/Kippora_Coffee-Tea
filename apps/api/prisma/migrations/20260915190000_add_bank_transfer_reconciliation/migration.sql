-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'AMOUNT_MISMATCH', 'DUPLICATE', 'IGNORED');

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "referenceCode" VARCHAR(32),
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill để đơn chuyển khoản cũ cũng có thể được tra cứu và đối soát.
UPDATE "Payment"
SET "referenceCode" = 'KIPOLD' || "id"::text,
    "expiresAt" = "createdAt" + INTERVAL '30 minutes'
WHERE "method" = 'BANK_TRANSFER' AND "referenceCode" IS NULL;

-- CreateTable
CREATE TABLE "BranchBankAccount" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "bankBin" VARCHAR(6) NOT NULL,
    "bankCode" VARCHAR(20) NOT NULL,
    "bankName" VARCHAR(120) NOT NULL,
    "accountNumber" VARCHAR(30) NOT NULL,
    "accountName" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BranchBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" SERIAL NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    "providerReference" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedPaymentId" INTEGER,
    "matchedAt" TIMESTAMP(3),
    "resolutionNote" VARCHAR(500),
    "resolvedById" INTEGER,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_referenceCode_key" ON "Payment"("referenceCode");
CREATE UNIQUE INDEX "BranchBankAccount_branchId_key" ON "BranchBankAccount"("branchId");
CREATE INDEX "BranchBankAccount_isActive_idx" ON "BranchBankAccount"("isActive");
CREATE UNIQUE INDEX "BankTransaction_providerReference_key" ON "BankTransaction"("providerReference");
CREATE UNIQUE INDEX "BankTransaction_matchedPaymentId_key" ON "BankTransaction"("matchedPaymentId");
CREATE INDEX "BankTransaction_bankAccountId_occurredAt_idx" ON "BankTransaction"("bankAccountId", "occurredAt");
CREATE INDEX "BankTransaction_status_occurredAt_idx" ON "BankTransaction"("status", "occurredAt");
CREATE INDEX "BankTransaction_matchedPaymentId_idx" ON "BankTransaction"("matchedPaymentId");
CREATE INDEX "BankTransaction_resolvedById_updatedAt_idx" ON "BankTransaction"("resolvedById", "updatedAt");

ALTER TABLE "BranchBankAccount" ADD CONSTRAINT "BranchBankAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BranchBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedPaymentId_fkey" FOREIGN KEY ("matchedPaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "BranchBankAccount" IS 'Tài khoản nhận chuyển khoản theo chi nhánh; không lưu khóa bí mật của nhà cung cấp.';
COMMENT ON TABLE "BankTransaction" IS 'Sao kê nhận từ webhook, tự động đối chiếu theo mã tham chiếu và số tiền.';
