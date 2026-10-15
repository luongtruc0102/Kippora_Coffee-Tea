-- CreateTable
CREATE TABLE "PasswordResetChallenge" (
    "id" UUID NOT NULL,
    "userId" INTEGER NOT NULL,
    "otpHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetChallenge_userId_consumedAt_createdAt_idx"
ON "PasswordResetChallenge"("userId", "consumedAt", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetChallenge_expiresAt_idx"
ON "PasswordResetChallenge"("expiresAt");

-- AddForeignKey
ALTER TABLE "PasswordResetChallenge"
ADD CONSTRAINT "PasswordResetChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
