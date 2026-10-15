-- Lưu vị trí thật trên từng chi nhánh để bản đồ công khai và nghiệp vụ giao hàng
-- cùng sử dụng một nguồn dữ liệu. Tọa độ MAIN được kế thừa từ cấu hình giao hàng
-- mà hệ thống đã dùng trước migration này.
ALTER TABLE "StoreBranch"
ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7);

UPDATE "StoreBranch"
SET
  "latitude" = 10.8569371,
  "longitude" = 106.7465042
WHERE "code" = 'MAIN'
  AND "latitude" IS NULL
  AND "longitude" IS NULL;
