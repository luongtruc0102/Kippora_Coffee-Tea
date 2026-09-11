import type { PayrollEntry } from "@/types/payroll";

export function payrollAttendanceLines(
  entry: PayrollEntry,
): { text: string; warning?: boolean }[] {
  const counts = entry.attendanceBreakdown;
  const lines: { text: string; warning?: boolean }[] = counts
    ? [
        {
          text: `Theo lịch: ${counts.scheduledCompletedShifts}/${entry.scheduledShifts} ca`,
        },
      ]
    : [
        { text: `Đã ghi nhận: ${entry.completedShifts} lượt` },
        { text: `Được xếp: ${entry.scheduledShifts} ca` },
      ];
  if (counts?.unscheduledAttendances)
    lines.push({ text: `Ngoài lịch: ${counts.unscheduledAttendances} lượt` });
  if (counts?.otherPeriodAttendances)
    lines.push({ text: `Lịch kỳ khác: ${counts.otherPeriodAttendances} lượt` });
  if (counts?.shortAttendances)
    lines.push({
      text: `Dưới 1 phút: ${counts.shortAttendances} lượt`,
      warning: true,
    });
  if (counts?.invalidAttendances)
    lines.push({
      text: `Cần kiểm tra giờ: ${counts.invalidAttendances} lượt`,
      warning: true,
    });
  if (entry.absentShifts)
    lines.push({ text: `Vắng: ${entry.absentShifts} ca` });
  if (entry.excusedLeaveShifts)
    lines.push({ text: `Nghỉ phép: ${entry.excusedLeaveShifts} ca` });
  return lines;
}
