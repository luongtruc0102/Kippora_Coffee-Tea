-- Trạng thái nhận đơn thuộc chi nhánh, không thuộc riêng tài khoản Staff.
ALTER TABLE "User"
DROP COLUMN "isAvailableForOrders",
DROP COLUMN "staffPauseReason";

CREATE TABLE "StoreBranch" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAcceptingOrders" BOOLEAN NOT NULL DEFAULT true,
    "pauseReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBranch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreBranch_code_key" ON "StoreBranch"("code");

INSERT INTO "StoreBranch" (
    "code",
    "name",
    "isActive",
    "isAcceptingOrders",
    "updatedAt"
)
VALUES (
    'MAIN',
    'Kippora - Chi nhánh chính',
    true,
    true,
    CURRENT_TIMESTAMP
);