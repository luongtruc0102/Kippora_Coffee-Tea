import { BadRequestException } from '@nestjs/common';
import { getDashboardPeriodRange } from './dashboard-period.util';

describe('getDashboardPeriodRange', () => {
  it('creates an inclusive custom range and an equally long previous range', () => {
    const range = getDashboardPeriodRange('CUSTOM', '2026-09-01', '2026-09-08');

    expect(range.dayCount).toBe(8);
    expect(range.startDate.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2026-09-08T16:59:59.999Z');
    expect(range.previousEndDate.getTime()).toBe(range.startDate.getTime() - 1);
    expect(
      range.previousEndDate.getTime() - range.previousStartDate.getTime(),
    ).toBe(range.endDate.getTime() - range.startDate.getTime());
  });

  it('rejects an invalid or reversed custom range', () => {
    expect(() =>
      getDashboardPeriodRange('CUSTOM', '2026-02-30', '2026-03-01'),
    ).toThrow(BadRequestException);
    expect(() =>
      getDashboardPeriodRange('CUSTOM', '2026-09-08', '2026-09-01'),
    ).toThrow(BadRequestException);
  });

  it('limits a custom range to 366 days', () => {
    expect(() =>
      getDashboardPeriodRange('CUSTOM', '2025-01-01', '2026-01-02'),
    ).toThrow(BadRequestException);
  });
});
