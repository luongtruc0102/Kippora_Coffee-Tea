-- CreateTable
CREATE TABLE "HomepageBanner" (
    "id" SERIAL NOT NULL,
    "eyebrow" VARCHAR(80),
    "title" VARCHAR(180) NOT NULL,
    "subtitle" VARCHAR(500),
    "buttonLabel" VARCHAR(60),
    "imageUrl" VARCHAR(500),
    "theme" VARCHAR(20) NOT NULL DEFAULT 'AMBER',
    "targetType" VARCHAR(30) NOT NULL DEFAULT 'NONE',
    "customUrl" VARCHAR(500),
    "productId" INTEGER,
    "voucherId" INTEGER,
    "contentPageId" INTEGER,
    "branchId" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomepageBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomepageBanner_isActive_startsAt_endsAt_sortOrder_idx"
ON "HomepageBanner"("isActive", "startsAt", "endsAt", "sortOrder");
CREATE INDEX "HomepageBanner_branchId_isActive_sortOrder_idx"
ON "HomepageBanner"("branchId", "isActive", "sortOrder");
CREATE INDEX "HomepageBanner_productId_idx" ON "HomepageBanner"("productId");
CREATE INDEX "HomepageBanner_voucherId_idx" ON "HomepageBanner"("voucherId");
CREATE INDEX "HomepageBanner_contentPageId_idx" ON "HomepageBanner"("contentPageId");

ALTER TABLE "HomepageBanner"
ADD CONSTRAINT "HomepageBanner_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HomepageBanner"
ADD CONSTRAINT "HomepageBanner_voucherId_fkey"
FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HomepageBanner"
ADD CONSTRAINT "HomepageBanner_contentPageId_fkey"
FOREIGN KEY ("contentPageId") REFERENCES "ContentPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HomepageBanner"
ADD CONSTRAINT "HomepageBanner_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "StoreBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomepageBanner"
ADD CONSTRAINT "HomepageBanner_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dữ liệu khởi tạo dùng nền màu nên hoạt động ngay cả khi chưa tải ảnh.
INSERT INTO "HomepageBanner"
    ("eyebrow", "title", "subtitle", "buttonLabel", "theme", "targetType", "contentPageId", "isActive", "sortOrder")
VALUES
    (
      'KIPPORA REWARDS',
      'Ưu đãi dành riêng cho bạn',
      'Khám phá chương trình mới và tận hưởng mỗi ngày một vị vui cùng Kippora.',
      'Xem ưu đãi',
      'AMBER',
      'CONTENT_PAGE',
      (SELECT "id" FROM "ContentPage" WHERE "slug" = 'uu-dai'),
      true,
      10
    ),
    (
      'MENU KIPPORA',
      'Chọn món theo cách bạn thích',
      'Cà phê, trà và topping được tùy chỉnh theo khẩu vị của riêng bạn.',
      'Khám phá menu',
      'COCOA',
      'MENU',
      NULL,
      true,
      20
    );
