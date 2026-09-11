CREATE TYPE "StaffShiftPeriod" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

CREATE TABLE "StaffShiftTemplate" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "period" "StaffShiftPeriod" NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffShiftTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffShiftTemplate_branchId_period_key"
ON "StaffShiftTemplate"("branchId", "period");

CREATE INDEX "StaffShiftTemplate_branchId_idx"
ON "StaffShiftTemplate"("branchId");

ALTER TABLE "StaffShiftTemplate"
ADD CONSTRAINT "StaffShiftTemplate_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "StaffShiftTemplate" IS
'Ba khung giờ ca chuẩn theo chi nhánh do Admin cấu hình; dùng làm mặc định khi trưởng chi nhánh xếp lịch.';

COMMENT ON COLUMN "StaffShiftTemplate"."period" IS
'Khung ca cố định: MORNING, AFTERNOON hoặc EVENING.';

COMMENT ON COLUMN "StaffShiftTemplate"."startTime" IS
'Giờ bắt đầu theo giờ Việt Nam, định dạng HH:mm.';

COMMENT ON COLUMN "StaffShiftTemplate"."endTime" IS
'Giờ kết thúc theo giờ Việt Nam, định dạng HH:mm.';

-- Khởi tạo giờ chuẩn hiện tại cho toàn bộ chi nhánh đã có.
INSERT INTO "StaffShiftTemplate" (
    "branchId", "period", "startTime", "endTime", "updatedAt"
)
SELECT "id", 'MORNING'::"StaffShiftPeriod", '06:00', '12:00', CURRENT_TIMESTAMP
FROM "StoreBranch";

INSERT INTO "StaffShiftTemplate" (
    "branchId", "period", "startTime", "endTime", "updatedAt"
)
SELECT "id", 'AFTERNOON'::"StaffShiftPeriod", '12:00', '18:00', CURRENT_TIMESTAMP
FROM "StoreBranch";

INSERT INTO "StaffShiftTemplate" (
    "branchId", "period", "startTime", "endTime", "updatedAt"
)
SELECT "id", 'EVENING'::"StaffShiftPeriod", '18:00', '22:00', CURRENT_TIMESTAMP
FROM "StoreBranch";
