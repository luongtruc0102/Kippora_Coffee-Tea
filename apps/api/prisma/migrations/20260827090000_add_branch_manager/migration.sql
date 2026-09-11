-- Mỗi chi nhánh có tối đa một trưởng và mỗi trưởng chỉ quản lý một chi nhánh.
ALTER TABLE "StoreBranch" ADD COLUMN "managerId" INTEGER;

CREATE UNIQUE INDEX "StoreBranch_managerId_key"
ON "StoreBranch"("managerId");

ALTER TABLE "StoreBranch"
ADD CONSTRAINT "StoreBranch_managerId_fkey"
FOREIGN KEY ("managerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;