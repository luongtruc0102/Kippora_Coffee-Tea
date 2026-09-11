const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function getVietnamDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const read = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function getCurrentWeekStart(reference = new Date()) {
  const dateKey = getVietnamDateKey(reference);
  const calendarDate = new Date(`${dateKey}T12:00:00Z`);
  const weekday = calendarDate.getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  calendarDate.setUTCDate(calendarDate.getUTCDate() - daysFromMonday);
  return calendarDate.toISOString().slice(0, 10);
}

export function shiftWeek(weekStart: string, amount: number) {
  const date = new Date(`${weekStart}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount * 7);
  return date.toISOString().slice(0, 10);
}

export function getWeekDates(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export function buildShiftIso(dateKey: string, time: string, nextDay = false) {
  const date = new Date(`${dateKey}T${time}:00+07:00`);
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export function formatScheduleTime(value: string | Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(value instanceof Date ? value : new Date(value));
}
