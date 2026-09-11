import { BadRequestException } from '@nestjs/common';

const VIETNAM_OFFSET = '+07:00';

export function getPayrollMonthRange(month: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) {
    throw new BadRequestException('Tháng lương phải có định dạng YYYY-MM');
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  const nextMonthIndex = (monthIndex + 1) % 12;
  const nextMonth = String(nextMonthIndex + 1).padStart(2, '0');

  return {
    month,
    periodStart: new Date(Date.UTC(year, monthIndex, 1)),
    periodEnd: new Date(Date.UTC(nextYear, nextMonthIndex, 1)),
    rangeStart: new Date(`${month}-01T00:00:00${VIETNAM_OFFSET}`),
    rangeEnd: new Date(`${nextYear}-${nextMonth}-01T00:00:00${VIETNAM_OFFSET}`),
  };
}

export function calculatePayrollAmounts(input: {
  regularSeconds: number;
  overtimeSeconds: number;
  hourlyRate: number;
  overtimeMultiplier: number;
  bonusAmount: number;
  deductionAmount: number;
  lateDeductionAmount: number;
  earlyLeaveDeductionAmount: number;
  absenceDeductionAmount: number;
}) {
  const baseAmount = Math.round(
    (input.regularSeconds / 3600) * input.hourlyRate,
  );
  const overtimeAmount = Math.round(
    (input.overtimeSeconds / 3600) *
      input.hourlyRate *
      input.overtimeMultiplier,
  );
  const totalAmount = Math.max(
    0,
    Math.round(
      baseAmount +
        overtimeAmount +
        input.bonusAmount -
        input.deductionAmount -
        input.lateDeductionAmount -
        input.earlyLeaveDeductionAmount -
        input.absenceDeductionAmount,
    ),
  );

  return { baseAmount, overtimeAmount, totalAmount };
}

export function calculateLateDeductionAmount(
  lateMinutes: number,
  hourlyRate: number,
) {
  return Math.round((Math.max(0, lateMinutes) / 60) * hourlyRate);
}

export function calculateUnexcusedLateMinutes(input: {
  shiftStartAt: Date;
  clockInAt: Date;
  approvedArrivalAt?: Date | null;
}) {
  const baseline = input.approvedArrivalAt ?? input.shiftStartAt;
  return Math.max(
    0,
    Math.floor((input.clockInAt.getTime() - baseline.getTime()) / 60_000),
  );
}

export function calculateEarlyLeaveDeductionAmount(
  unexcusedEarlyLeaveMinutes: number,
  hourlyRate: number,
) {
  return Math.round(
    (Math.max(0, unexcusedEarlyLeaveMinutes) / 60) * hourlyRate,
  );
}

export function calculateAbsenceDeductionAmount(
  unexcusedAbsentSeconds: number,
  hourlyRate: number,
  penaltyRate = 0.5,
) {
  return Math.round(
    (Math.max(0, unexcusedAbsentSeconds) / 3600) *
      hourlyRate *
      Math.max(0, penaltyRate),
  );
}

export function calculateEarlyLeaveMinutes(input: {
  shiftEndAt: Date;
  clockOutAt: Date;
  approvedEndAt?: Date | null;
}) {
  const earlyLeaveMinutes = Math.max(
    0,
    Math.floor(
      (input.shiftEndAt.getTime() - input.clockOutAt.getTime()) / 60_000,
    ),
  );
  const unexcusedEarlyLeaveMinutes = input.approvedEndAt
    ? Math.max(
        0,
        Math.floor(
          (input.approvedEndAt.getTime() - input.clockOutAt.getTime()) / 60_000,
        ),
      )
    : earlyLeaveMinutes;

  return {
    earlyLeaveMinutes,
    unexcusedEarlyLeaveMinutes: Math.min(
      earlyLeaveMinutes,
      unexcusedEarlyLeaveMinutes,
    ),
  };
}
