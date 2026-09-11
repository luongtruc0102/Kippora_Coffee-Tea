import { classifyPayrollAttendances } from './payroll-attendance.util';

describe('classifyPayrollAttendances', () => {
  const clockIn = new Date('2026-09-03T09:00:00Z');
  const record = (
    seconds: number | null,
    scheduledShiftId: number | null = null,
  ) => ({
    clockIn,
    clockOut:
      seconds === null ? null : new Date(clockIn.getTime() + seconds * 1000),
    scheduledShiftId,
  });

  it('does not label two unscheduled sessions as two completed scheduled shifts', () => {
    expect(classifyPayrollAttendances([record(10), record(900)], [1])).toEqual({
      scheduledCompletedShifts: 0,
      unscheduledAttendances: 2,
      otherPeriodAttendances: 0,
      shortAttendances: 1,
      invalidAttendances: 0,
    });
  });

  it('counts a scheduled shift once even if multiple sessions refer to it', () => {
    expect(
      classifyPayrollAttendances(
        [record(900, 1), record(1200, 1), record(900, 2)],
        [1, 2],
      ).scheduledCompletedShifts,
    ).toBe(2);
  });

  it('flags zero and reversed records and ignores open attendance', () => {
    expect(
      classifyPayrollAttendances(
        [record(0, 1), record(-60, 1), record(null, 1)],
        [1],
      ),
    ).toEqual({
      scheduledCompletedShifts: 0,
      unscheduledAttendances: 0,
      otherPeriodAttendances: 0,
      shortAttendances: 0,
      invalidAttendances: 2,
    });
  });

  it('separates attendance linked to a different payroll period and respects the one-minute boundary', () => {
    expect(
      classifyPayrollAttendances([record(60, 2), record(59, 1)], [1]),
    ).toEqual({
      scheduledCompletedShifts: 1,
      unscheduledAttendances: 0,
      otherPeriodAttendances: 1,
      shortAttendances: 1,
      invalidAttendances: 0,
    });
  });
});
