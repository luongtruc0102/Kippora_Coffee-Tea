import {
  calculateAbsenceDeductionAmount,
  calculateEarlyLeaveDeductionAmount,
  calculateEarlyLeaveMinutes,
  calculateLateDeductionAmount,
  calculateUnexcusedLateMinutes,
  calculatePayrollAmounts,
  getPayrollMonthRange,
} from './payroll.util';

describe('payroll utilities', () => {
  describe('getPayrollMonthRange', () => {
    it('uses calendar month boundaries and Vietnam attendance boundaries', () => {
      const range = getPayrollMonthRange('2026-09');

      expect(range.periodStart.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(range.periodEnd.toISOString()).toBe('2026-10-01T00:00:00.000Z');
      expect(range.rangeStart.toISOString()).toBe('2026-08-31T17:00:00.000Z');
      expect(range.rangeEnd.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    });
  });

  describe('calculatePayrollAmounts', () => {
    it('calculates regular pay, overtime, adjustments and total', () => {
      expect(
        calculatePayrollAmounts({
          regularSeconds: 8 * 3600,
          overtimeSeconds: 2 * 3600,
          hourlyRate: 32000,
          overtimeMultiplier: 1.5,
          bonusAmount: 100000,
          deductionAmount: 20000,
          lateDeductionAmount: 0,
          earlyLeaveDeductionAmount: 0,
          absenceDeductionAmount: 0,
        }),
      ).toEqual({
        baseAmount: 256000,
        overtimeAmount: 96000,
        totalAmount: 432000,
      });
    });

    it('never returns a negative payable total', () => {
      expect(
        calculatePayrollAmounts({
          regularSeconds: 3600,
          overtimeSeconds: 0,
          hourlyRate: 32000,
          overtimeMultiplier: 1.5,
          bonusAmount: 0,
          deductionAmount: 100000,
          lateDeductionAmount: 0,
          earlyLeaveDeductionAmount: 0,
          absenceDeductionAmount: 0,
        }).totalAmount,
      ).toBe(0);
    });

    it('subtracts the automatic late deduction from take-home pay', () => {
      expect(
        calculatePayrollAmounts({
          regularSeconds: 8 * 3600,
          overtimeSeconds: 0,
          hourlyRate: 32000,
          overtimeMultiplier: 1.5,
          bonusAmount: 0,
          deductionAmount: 0,
          lateDeductionAmount: 5333,
          earlyLeaveDeductionAmount: 0,
          absenceDeductionAmount: 0,
        }).totalAmount,
      ).toBe(250667);
    });
  });

  describe('calculateLateDeductionAmount', () => {
    it.each([
      [10, 5333],
      [17, 9067],
      [23, 12267],
    ])('deducts %i late minutes proportionally', (minutes, amount) => {
      expect(calculateLateDeductionAmount(minutes, 32000)).toBe(amount);
    });

    it('does not produce a negative deduction', () => {
      expect(calculateLateDeductionAmount(-10, 32000)).toBe(0);
    });
  });

  describe('calculateUnexcusedLateMinutes', () => {
    const shiftStartAt = new Date('2026-09-07T01:00:00.000Z');

    it('miễn phạt phần đến trễ đã được duyệt', () => {
      expect(
        calculateUnexcusedLateMinutes({
          shiftStartAt,
          approvedArrivalAt: new Date('2026-09-07T02:00:00.000Z'),
          clockInAt: new Date('2026-09-07T02:00:00.000Z'),
        }),
      ).toBe(0);
    });

    it('chỉ phạt số phút vượt quá giờ đến đã được duyệt', () => {
      expect(
        calculateUnexcusedLateMinutes({
          shiftStartAt,
          approvedArrivalAt: new Date('2026-09-07T02:00:00.000Z'),
          clockInAt: new Date('2026-09-07T02:17:00.000Z'),
        }),
      ).toBe(17);
    });
  });

  describe('calculateEarlyLeaveDeductionAmount', () => {
    it('deducts only unexcused early-leave minutes proportionally', () => {
      expect(calculateEarlyLeaveDeductionAmount(30, 32000)).toBe(16000);
      expect(calculateEarlyLeaveDeductionAmount(0, 32000)).toBe(0);
    });
  });

  describe('calculateAbsenceDeductionAmount', () => {
    it('deducts 50 percent of an unexcused absent shift by default', () => {
      expect(calculateAbsenceDeductionAmount(5 * 3600, 32000)).toBe(80000);
    });

    it('does not produce a negative deduction', () => {
      expect(calculateAbsenceDeductionAmount(-3600, 32000)).toBe(0);
    });
  });

  describe('calculateEarlyLeaveMinutes', () => {
    const shiftEndAt = new Date('2026-09-07T05:00:00.000Z');

    it('does not penalize an employee who leaves at the approved time', () => {
      expect(
        calculateEarlyLeaveMinutes({
          shiftEndAt,
          clockOutAt: new Date('2026-09-07T04:00:00.000Z'),
          approvedEndAt: new Date('2026-09-07T04:00:00.000Z'),
        }),
      ).toEqual({
        earlyLeaveMinutes: 60,
        unexcusedEarlyLeaveMinutes: 0,
      });
    });

    it('penalizes only minutes earlier than the approved time', () => {
      expect(
        calculateEarlyLeaveMinutes({
          shiftEndAt,
          clockOutAt: new Date('2026-09-07T03:30:00.000Z'),
          approvedEndAt: new Date('2026-09-07T04:00:00.000Z'),
        }),
      ).toEqual({
        earlyLeaveMinutes: 90,
        unexcusedEarlyLeaveMinutes: 30,
      });
    });

    it('penalizes all early minutes without an approval', () => {
      expect(
        calculateEarlyLeaveMinutes({
          shiftEndAt,
          clockOutAt: new Date('2026-09-07T04:00:00.000Z'),
        }),
      ).toEqual({
        earlyLeaveMinutes: 60,
        unexcusedEarlyLeaveMinutes: 60,
      });
    });

    it('does not create negative minutes when clocking out after shift end', () => {
      expect(
        calculateEarlyLeaveMinutes({
          shiftEndAt,
          clockOutAt: new Date('2026-09-07T05:15:00.000Z'),
        }),
      ).toEqual({
        earlyLeaveMinutes: 0,
        unexcusedEarlyLeaveMinutes: 0,
      });
    });
  });
});
