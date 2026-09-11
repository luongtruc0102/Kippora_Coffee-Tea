-- Ghi lại nguồn tự động để bảng công có thể giải trình việc chia chuỗi ca.
ALTER TABLE "StaffAttendance"
ADD COLUMN "autoClockIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoClockOut" BOOLEAN NOT NULL DEFAULT false;
