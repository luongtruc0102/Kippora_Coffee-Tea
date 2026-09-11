export type PayrollStatus = "DRAFT" | "FINALIZED" | "PAID";
export type PayrollPaymentMethod = "CASH" | "BANK_TRANSFER";
export type PayrollAdjustmentType = "BONUS" | "DEDUCTION";

export type PayrollPerson = {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export type PayrollAdjustment = {
  id: number;
  payrollEntryId: number;
  type: PayrollAdjustmentType;
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: PayrollPerson | null;
};

export type PayrollEntry = {
  id: number;
  payrollPeriodId: number;
  employeeId: number;
  employee: PayrollPerson & {
    isActive: boolean;
    role: "STAFF" | "BRANCH_MANAGER";
    hourlyRate: number;
    overtimeMultiplier: number;
  };
  hourlyRateSnapshot: number;
  overtimeMultiplierSnapshot: number;
  regularSeconds: number;
  overtimeSeconds: number;
  scheduledShifts: number;
  completedShifts: number;
  attendanceBreakdown?: {
    scheduledCompletedShifts: number;
    unscheduledAttendances: number;
    otherPeriodAttendances: number;
    shortAttendances: number;
    invalidAttendances: number;
  } | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  unexcusedEarlyLeaveMinutes: number;
  absentShifts: number;
  unexcusedAbsentSeconds: number;
  excusedLeaveShifts: number;
  baseAmount: number;
  overtimeAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  lateDeductionAmount: number;
  earlyLeaveDeductionAmount: number;
  absenceDeductionAmount: number;
  totalDeductionAmount: number;
  totalAmount: number;
  adjustments: PayrollAdjustment[];
  createdAt: string;
  updatedAt: string;
};

export type PayrollReport = {
  id: number;
  branch: {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
  };
  month: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollStatus;
  generatedAt: string;
  finalizedAt: string | null;
  finalizedBy: PayrollPerson | null;
  paidAt: string | null;
  paidBy: PayrollPerson | null;
  paymentMethod: PayrollPaymentMethod | null;
  paymentReference: string | null;
  attendanceReview: {
    id: number;
    status: "DRAFT" | "PENDING" | "APPROVED" | "RETURNED";
    revision: number;
    submittedAt: string | null;
    submittedBy: PayrollPerson | null;
    reviewedAt: string | null;
    reviewedBy: PayrollPerson | null;
    reviewNote: string | null;
  } | null;
  canFinalize: boolean;
  openAttendances?: number;
  summary: {
    employees: number;
    regularSeconds: number;
    overtimeSeconds: number;
    baseAmount: number;
    overtimeAmount: number;
    bonusAmount: number;
    deductionAmount: number;
    lateDeductionAmount: number;
    earlyLeaveDeductionAmount: number;
    absenceDeductionAmount: number;
    totalDeductionAmount: number;
    totalAmount: number;
  };
  entries: PayrollEntry[];
  rules: {
    minimumHourlyRate: number;
    defaultHourlyRate: number;
    defaultOvertimeMultiplier: number;
    absencePenaltyRate: number;
  };
};

export type UpdatePayrollRateInput = {
  hourlyRate: number;
  overtimeMultiplier: number;
};

export type UpdatePayrollRoleRatesInput = {
  branchId: number;
  staff: UpdatePayrollRateInput;
  manager: UpdatePayrollRateInput;
};

export type UpdatePayrollRoleRatesResult = {
  updated: { staff: number; managers: number };
};

export type CreatePayrollAdjustmentInput = {
  type: PayrollAdjustmentType;
  amount: number;
  reason: string;
};
