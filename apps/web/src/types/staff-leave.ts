export type StaffLeaveType = "PLANNED" | "EMERGENCY";
export type StaffLeaveScope = "FULL_SHIFT" | "LATE_ARRIVAL" | "EARLY_LEAVE";
export type StaffLeaveStatus =
  "PENDING" | "NEEDS_INFO" | "APPROVED" | "REJECTED" | "CANCELLED";
export type StaffShiftCoverageStatus =
  "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";

export type StaffShiftCoverage = {
  id: number;
  leaveRequestId: number;
  branchId: number;
  coveringEmployeeId: number;
  assignedById: number;
  startAt: string;
  endAt: string;
  actualEndAt: string | null;
  status: StaffShiftCoverageStatus;
  respondedAt: string | null;
  coveringEmployee: {
    id: number;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    phone: string | null;
  };
  assignedBy: {
    id: number;
    email: string;
    fullName: string | null;
  };
};

export type StaffLeaveRequest = {
  id: number;
  employeeId: number;
  branchId: number;
  staffShiftId: number;
  type: StaffLeaveType;
  scope: StaffLeaveScope;
  requestedStartAt: string | null;
  requestedEndAt: string | null;
  status: StaffLeaveStatus;
  reason: string;
  evidenceUrl: string | null;
  reviewNote: string | null;
  reviewedById: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: number;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    phone: string | null;
  };
  branch: { id: number; code: string; name: string };
  staffShift: {
    id: number;
    startAt: string;
    endAt: string;
    note: string | null;
  };
  reviewedBy: {
    id: number;
    email: string;
    fullName: string | null;
  } | null;
  coverage: StaffShiftCoverage | null;
};

export type MyLeaveSchedule = {
  serverTime: string;
  rules: {
    plannedNoticeHours: number;
    emergencyFollowUpHours: number;
  };
  branch: { id: number; code: string; name: string };
  shifts: Array<{
    id: number;
    employeeId: number;
    branchId: number;
    startAt: string;
    endAt: string;
    note: string | null;
    hasAttendance: boolean;
    leaveRequest: StaffLeaveRequest | null;
  }>;
  coverageAssignments?: Array<{
    id: number;
    leaveRequestId: number;
    startAt: string;
    endAt: string;
    actualEndAt: string | null;
    status: StaffShiftCoverageStatus;
    respondedAt: string | null;
    leaveRequest: {
      reason: string;
      employee: {
        id: number;
        email: string;
        fullName: string | null;
      };
      staffShift: { id: number; startAt: string; endAt: string };
    };
    assignedBy: { id: number; email: string; fullName: string | null };
  }>;
};

export type BranchLeaveRequests = {
  branch: { id: number; code: string; name: string; isActive: boolean };
  pendingCount: number;
  items: StaffLeaveRequest[];
};

export type CreateStaffLeaveInput = {
  staffShiftId: number;
  type: StaffLeaveType;
  scope?: StaffLeaveScope;
  requestedStartAt?: string;
  requestedEndAt?: string;
  reason: string;
  evidenceUrl?: string;
};

export type ReviewStaffLeaveInput = {
  action: "APPROVED" | "REJECTED" | "NEEDS_INFO";
  note?: string;
  coveringEmployeeId?: number;
};

export type ShiftCoverageCandidate = {
  employee: {
    id: number;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    phone: string | null;
  };
  previousShiftStartAt: string;
  previousShiftEndAt: string;
};
