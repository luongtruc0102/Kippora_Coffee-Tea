export type ScheduleEmployee = {
  id: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  isActive: boolean;
};

export type StaffShiftPeriod = "MORNING" | "AFTERNOON" | "EVENING";

export type StaffShiftTemplate = {
  id: number | null;
  branchId: number;
  period: StaffShiftPeriod;
  startTime: string;
  endTime: string;
};

export type StaffShift = {
  id: number;
  employeeId: number;
  branchId: number;
  startAt: string;
  endAt: string;
  note: string | null;
  createdById: number | null;
  createdAt: string;
  updatedAt: string;
  employee: ScheduleEmployee;
};

export type StaffScheduleWeek = {
  branch: {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
  };
  weekStart: string;
  employees: ScheduleEmployee[];
  shifts: StaffShift[];
  templates: StaffShiftTemplate[];
};

export type MyScheduleStatus = {
  serverTime: string;
  checkInEarlyMinutes: number;
  hasOpenAttendance: boolean;
  canCheckIn: boolean;
  eligibleShift: StaffShift | null;
  nextShift: StaffShift | null;
  checkInOpensAt: string | null;
};

export type SaveStaffShiftInput = {
  employeeId: number;
  startAt: string;
  endAt: string;
  note?: string;
};

export type UpdateStaffShiftInput = Omit<SaveStaffShiftInput, "employeeId">;

export type UpdateStaffShiftTemplatesInput = Array<{
  period: StaffShiftPeriod;
  startTime: string;
  endTime: string;
}>;

export type AttendanceReportStatus =
  | "UPCOMING"
  | "ABSENT"
  | "IN_PROGRESS"
  | "LATE_IN_PROGRESS"
  | "ON_TIME"
  | "LATE"
  | "EARLY_LEAVE"
  | "LATE_AND_EARLY"
  | "UNSCHEDULED"
  | "EXCUSED_LEAVE"
  | "LEAVE_PENDING"
  | "LEAVE_NEEDS_INFO";

export type AttendanceReportRow = {
  key: string;
  shiftId: number | null;
  attendanceId: number | null;
  employee: ScheduleEmployee;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  autoClockIn: boolean;
  autoClockOut: boolean;
  status: AttendanceReportStatus;
  isLate: boolean;
  isEarlyLeave: boolean;
  workedSeconds: number;
  scheduledSeconds: number;
  overtimeSeconds: number;
  adjustmentReason: string | null;
  updatedBy: {
    id: number;
    fullName: string | null;
    email: string;
  } | null;
  leaveRequest: {
    id: number;
    type: "PLANNED" | "EMERGENCY";
    status: "PENDING" | "NEEDS_INFO" | "APPROVED";
    reason: string;
    evidenceUrl: string | null;
    reviewNote: string | null;
  } | null;
};

export type AttendanceEmployeeSummary = {
  employee: ScheduleEmployee;
  scheduledShifts: number;
  attendedShifts: number;
  completedShifts: number;
  lateShifts: number;
  earlyLeaveShifts: number;
  absentShifts: number;
  excusedLeaveShifts: number;
  workedSeconds: number;
  overtimeSeconds: number;
};

export type AttendanceReport = {
  branch: {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
  };
  startDate: string;
  endDate: string;
  generatedAt: string;
  timeZone: string;
  summary: {
    scheduledShifts: number;
    completedShifts: number;
    onTimeShifts: number;
    lateShifts: number;
    earlyLeaveShifts: number;
    absentShifts: number;
    excusedLeaveShifts: number;
    pendingLeaveShifts: number;
    workedSeconds: number;
    overtimeSeconds: number;
  };
  employees: AttendanceEmployeeSummary[];
  rows: AttendanceReportRow[];
};

export type UpdateStaffAttendanceInput = {
  clockIn: string;
  clockOut: string;
  reason: string;
};

export type AttendancePeriodStatus =
  "DRAFT" | "PENDING" | "APPROVED" | "RETURNED";

export type AttendancePeriodPerson = {
  id: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
};

export type AttendancePeriodEvent = {
  id: number;
  action: "SUBMITTED" | "APPROVED" | "RETURNED" | "REOPENED";
  fromStatus: AttendancePeriodStatus;
  toStatus: AttendancePeriodStatus;
  note: string | null;
  actor: AttendancePeriodPerson | null;
  createdAt: string;
};

export type AttendancePeriod = {
  id: number | null;
  branch: {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
  };
  month: string;
  periodStart: string;
  periodEnd: string;
  status: AttendancePeriodStatus;
  revision: number;
  submittedAt: string | null;
  submittedBy: AttendancePeriodPerson | null;
  reviewedAt: string | null;
  reviewedBy: AttendancePeriodPerson | null;
  reviewNote: string | null;
  locked: boolean;
  canSubmit: boolean;
  events: AttendancePeriodEvent[];
};
