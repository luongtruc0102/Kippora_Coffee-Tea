type AttendanceForPayroll = {
  clockIn: Date;
  clockOut: Date | null;
  scheduledShiftId: number | null;
};

/** Counts shift identities separately from attendance sessions; never estimates worked time. */
export function classifyPayrollAttendances(
  attendances: AttendanceForPayroll[],
  scheduledShiftIds: number[],
) {
  const scheduled = new Set(scheduledShiftIds);
  const completed = new Set<number>();
  const result = {
    scheduledCompletedShifts: 0,
    unscheduledAttendances: 0,
    otherPeriodAttendances: 0,
    shortAttendances: 0,
    invalidAttendances: 0,
  };
  for (const attendance of attendances) {
    if (!attendance.clockOut) continue;
    const milliseconds =
      attendance.clockOut.getTime() - attendance.clockIn.getTime();
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
      result.invalidAttendances += 1;
      continue;
    }
    if (milliseconds < 60_000) result.shortAttendances += 1;
    if (attendance.scheduledShiftId === null) {
      result.unscheduledAttendances += 1;
    } else if (scheduled.has(attendance.scheduledShiftId)) {
      completed.add(attendance.scheduledShiftId);
    } else {
      result.otherPeriodAttendances += 1;
    }
  }
  result.scheduledCompletedShifts = completed.size;
  return result;
}
