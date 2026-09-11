ALTER TABLE "User" ADD COLUMN "branchId" INTEGER;

ALTER TABLE "Order" ADD COLUMN "branchId" INTEGER;

UPDATE "User"
SET "branchId" = (SELECT "id" FROM "StoreBranch" WHERE "code" = 'MAIN')
WHERE "roleId" = (SELECT "id" FROM "Role" WHERE "name" = 'STAFF');

UPDATE "Order"
SET "branchId" = (SELECT "id" FROM "StoreBranch" WHERE "code" = 'MAIN')
WHERE "branchId" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "User"
ADD CONSTRAINT "User_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "User_branchId_idx" ON "User"("branchId");
CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");