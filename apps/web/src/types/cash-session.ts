export type CashSessionStatus = "OPEN" | "PENDING_REVIEW" | "APPROVED";
export type CashSessionEventType =
  "OPENED" | "CLOSED" | "APPROVED" | "REOPENED";

export type CashSessionPerson = {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export type CashSessionBranch = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

export type CashSessionEvent = {
  id: number;
  type: CashSessionEventType;
  reason: string | null;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
  actor: CashSessionPerson | null;
};

export type CashSession = {
  id: number;
  code: string;
  branchId: number;
  branch: CashSessionBranch;
  businessDate: string;
  status: CashSessionStatus;
  openingFloat: number;
  openingNote: string | null;
  openedBy: CashSessionPerson;
  openedAt: string;
  cashSalesAmount: number;
  bankSalesAmount: number;
  cashExpenseAmount: number;
  cashRefundAmount: number;
  bankRefundAmount: number;
  expectedCash: number;
  pendingCashExpenses: number;
  actualCash: number | null;
  difference: number | null;
  closingNote: string | null;
  closedBy: CashSessionPerson | null;
  closedAt: string | null;
  approvedBy: CashSessionPerson | null;
  approvedAt: string | null;
  reviewNote: string | null;
  reopenedBy: CashSessionPerson | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  events: CashSessionEvent[];
  createdAt: string;
  updatedAt: string;
};

export type CashSessionList = {
  sessions: CashSession[];
  branches: CashSessionBranch[];
  scopedBranchId: number | null;
  today: string;
  summary: {
    total: number;
    open: number;
    pending: number;
    approved: number;
    totalDifference: number;
  };
};

export type CashSessionFilters = {
  branchId?: number;
  status?: CashSessionStatus | "ALL";
  from?: string;
  to?: string;
};
