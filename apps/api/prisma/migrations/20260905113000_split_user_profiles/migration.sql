-- Tách dữ liệu tài khoản, hồ sơ cá nhân, khách hàng và nhân sự.
-- userId của các profile dùng lại User.id nên toàn bộ khóa ngoại nghiệp vụ cũ được giữ nguyên.

CREATE TABLE "UserProfile" (
    "userId" INTEGER NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "CustomerProfile" (
    "userId" INTEGER NOT NULL,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "StaffProfile" (
    "userId" INTEGER NOT NULL,
    "branchId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("userId")
);

-- Chuyển nguyên trạng dữ liệu cũ trước khi xóa cột khỏi User.
INSERT INTO "UserProfile" (
    "userId", "fullName", "phone", "avatarUrl", "address", "createdAt", "updatedAt"
)
SELECT
    "id", "fullName", "phone", "avatarUrl", "address", "createdAt", "updatedAt"
FROM "User";

-- Mọi tài khoản, kể cả nhân viên, đều có thể mua hàng và tích điểm như khách.
INSERT INTO "CustomerProfile" (
    "userId", "loyaltyPoints", "createdAt", "updatedAt"
)
SELECT
    "id", "loyaltyPoints", "createdAt", "updatedAt"
FROM "User";

-- Chỉ tạo hồ sơ nhân sự cho STAFF/BRANCH_MANAGER hoặc tài khoản đã có chi nhánh.
INSERT INTO "StaffProfile" (
    "userId", "branchId", "createdAt", "updatedAt"
)
SELECT
    u."id", u."branchId", u."createdAt", u."updatedAt"
FROM "User" u
JOIN "Role" r ON r."id" = u."roleId"
WHERE u."branchId" IS NOT NULL OR r."name" IN ('STAFF', 'BRANCH_MANAGER');

CREATE UNIQUE INDEX "UserProfile_phone_key" ON "UserProfile"("phone");
CREATE INDEX "StaffProfile_branchId_idx" ON "StaffProfile"("branchId");

ALTER TABLE "UserProfile"
ADD CONSTRAINT "UserProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerProfile"
ADD CONSTRAINT "CustomerProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffProfile"
ADD CONSTRAINT "StaffProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffProfile"
ADD CONSTRAINT "StaffProfile_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sau khi dữ liệu đã được sao chép và ràng buộc, loại bỏ phần hồ sơ khỏi bảng đăng nhập.
ALTER TABLE "User" DROP CONSTRAINT "User_branchId_fkey";
DROP INDEX "User_phone_key";
DROP INDEX "User_branchId_idx";

ALTER TABLE "User"
    DROP COLUMN "fullName",
    DROP COLUMN "phone",
    DROP COLUMN "avatarUrl",
    DROP COLUMN "address",
    DROP COLUMN "loyaltyPoints",
    DROP COLUMN "branchId";

COMMENT ON TABLE "User" IS
'Tài khoản đăng nhập và phân quyền cốt lõi; dữ liệu cá nhân, khách hàng và nhân sự nằm trong các bảng profile một-một.';
COMMENT ON TABLE "UserProfile" IS
'Thông tin cá nhân dùng chung cho mọi tài khoản, tách khỏi email, mật khẩu và trạng thái đăng nhập.';
COMMENT ON TABLE "CustomerProfile" IS
'Thông tin khách hàng của tài khoản; nhân viên vẫn có hồ sơ này để mua hàng và sử dụng điểm.';
COMMENT ON TABLE "StaffProfile" IS
'Thông tin phân công dành riêng cho STAFF và BRANCH_MANAGER.';

COMMENT ON COLUMN "UserProfile"."userId" IS 'Khóa chính đồng thời là khóa ngoại đến User.id.';
COMMENT ON COLUMN "UserProfile"."fullName" IS 'Họ tên hiển thị của người dùng.';
COMMENT ON COLUMN "UserProfile"."phone" IS 'Số điện thoại duy nhất dùng liên hệ và tra cứu khách POS.';
COMMENT ON COLUMN "UserProfile"."avatarUrl" IS 'Đường dẫn ảnh đại diện.';
COMMENT ON COLUMN "UserProfile"."address" IS 'Địa chỉ hồ sơ dạng văn bản; địa chỉ giao hàng chi tiết nằm trong UserAddress.';
COMMENT ON COLUMN "CustomerProfile"."loyaltyPoints" IS 'Số điểm khách hàng hiện có.';
COMMENT ON COLUMN "StaffProfile"."branchId" IS 'Chi nhánh làm việc hiện tại của nhân viên hoặc trưởng chi nhánh.';
