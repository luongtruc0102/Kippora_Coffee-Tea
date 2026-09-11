ALTER TABLE "StaffPayrollEntry" ADD COLUMN "attendanceBreakdown" JSONB;

COMMENT ON COLUMN "StaffPayrollEntry"."attendanceBreakdown" IS 'Snapshot phân loại chấm công: scheduledCompletedShifts (ca theo lịch trong kỳ, đếm duy nhất), unscheduledAttendances (lượt không gắn lịch), otherPeriodAttendances (lượt gắn lịch ngoài kỳ), shortAttendances (0 < thời gian < 60 giây), invalidAttendances (thời gian <= 0). Bỏ qua lượt chưa kết thúc. Null với kỳ cũ; không tính lại kỳ đã chốt.';
