-- Ngày khai trương thực tế của từng chi nhánh.
ALTER TABLE "StoreBranch"
ADD COLUMN "openedAt" DATE;
