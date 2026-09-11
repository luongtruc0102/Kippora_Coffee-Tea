import type { AttendanceReportStatus } from "@/types/staff-schedule";

export const attendanceStatusLabels: Record<AttendanceReportStatus, string> = {
  UPCOMING: "Chưa tới ca",
  ABSENT: "Vắng mặt",
  IN_PROGRESS: "Đang trong ca",
  LATE_IN_PROGRESS: "Đang làm · đi trễ",
  ON_TIME: "Đúng giờ",
  LATE: "Đi trễ",
  EARLY_LEAVE: "Về sớm",
  LATE_AND_EARLY: "Đi trễ & về sớm",
  UNSCHEDULED: "Ngoài lịch",
  EXCUSED_LEAVE: "Nghỉ có phép",
  LEAVE_PENDING: "Nghỉ chờ duyệt",
  LEAVE_NEEDS_INFO: "Nghỉ cần bổ sung",
};

export function formatAttendanceDuration(seconds: number) {
  const normalized = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

export function formatAttendanceDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

export function formatAttendanceTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function toVietnamDateTimeInput(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}

export function vietnamDateTimeInputToIso(value: string) {
  const date = new Date(`${value}:00+07:00`);
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error("Thời gian chấm công không hợp lệ");
  }
  return date.toISOString();
}
