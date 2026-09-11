import { BadRequestException } from '@nestjs/common';
import type { DashboardPeriod } from '../dashboard.types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 366;
const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function calendarDate(value: Date) {
  const [year, month, day] = vietnamDateFormatter.format(value).split('-');
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function dateKey(value: Date) {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function parseDate(value: string, endOfDay = false) {
  if (!DATE_PATTERN.test(value)) {
    throw new BadRequestException('Ngày lọc phải có định dạng YYYY-MM-DD.');
  }

  const [year, month, day] = value.split('-').map(Number);
  const maximumDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (month < 1 || month > 12 || day < 1 || day > maximumDay) {
    throw new BadRequestException('Khoảng ngày lọc không hợp lệ.');
  }

  return new Date(
    `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`,
  );
}

// Tính khoảng thời gian dùng chung cho Dashboard
export function getDashboardPeriodRange(
  period: DashboardPeriod = '7D',
  from?: string,
  to?: string,
) {
  if (period === 'CUSTOM') {
    if (!from || !to) {
      throw new BadRequestException(
        'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.',
      );
    }

    const startDate = parseDate(from);
    const endDate = parseDate(to, true);

    if (startDate > endDate) {
      throw new BadRequestException(
        'Ngày bắt đầu không được nằm sau ngày kết thúc.',
      );
    }

    const dayCount =
      Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

    if (dayCount > MAX_CUSTOM_DAYS) {
      throw new BadRequestException(
        'Khoảng ngày tùy chọn không được vượt quá 366 ngày.',
      );
    }

    const previousEndDate = new Date(startDate.getTime() - 1);
    const previousStartDate = new Date(
      previousEndDate.getTime() - (endDate.getTime() - startDate.getTime()),
    );

    return {
      startDate,
      endDate,
      previousStartDate,
      previousEndDate,
      dayCount,
    };
  }

  const endDate = new Date();
  const startCalendarDate = calendarDate(endDate);

  switch (period) {
    case '30D':
      startCalendarDate.setUTCDate(startCalendarDate.getUTCDate() - 29);
      break;

    case '1Y':
      startCalendarDate.setUTCDate(1);
      startCalendarDate.setUTCMonth(startCalendarDate.getUTCMonth() - 11);
      break;

    case '7D':
    default:
      startCalendarDate.setUTCDate(startCalendarDate.getUTCDate() - 6);
      break;
  }

  const startDate = parseDate(dateKey(startCalendarDate));

  const dayCount =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(
    previousEndDate.getTime() - (endDate.getTime() - startDate.getTime()),
  );

  return {
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    dayCount,
  };
}
