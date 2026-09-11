-- Thông tin liên hệ để Admin quản lý danh sách chi nhánh.
ALTER TABLE "StoreBranch"
ADD COLUMN "address" VARCHAR(255),
ADD COLUMN "phone" VARCHAR(20);
