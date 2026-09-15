ALTER TABLE "Notification"
ADD COLUMN "dedupeKey" VARCHAR(180);

CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key"
ON "Notification"("userId", "dedupeKey");

COMMENT ON COLUMN "Notification"."dedupeKey"
IS 'Khóa ổn định để cảnh báo vận hành theo thời gian không bị tạo lặp khi giao diện polling.';
