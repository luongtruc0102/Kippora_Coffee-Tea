export type ExpenseCategory =
  | "RENT"
  | "UTILITIES"
  | "MAINTENANCE"
  | "MARKETING"
  | "SUPPLIES"
  | "TRANSPORT"
  | "OTHER";

export type ExpenseStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type ExpensePaymentMethod = "CASH" | "BANK_TRANSFER";

export type ExpenseBranch = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
};

export type ExpensePerson = {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export type BranchExpense = {
  id: number;
  code: string;
  branchId: number;
  branch: ExpenseBranch;
  createdById: number;
  createdBy: ExpensePerson;
  reviewedById: number | null;
  reviewedBy: ExpensePerson | null;
  category: ExpenseCategory;
  paymentMethod: ExpensePaymentMethod;
  amount: number;
  incurredOn: string;
  description: string;
  note: string | null;
  status: ExpenseStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = {
  branchId: number;
  category: ExpenseCategory;
  paymentMethod: ExpensePaymentMethod;
  amount: number;
  incurredOn: string;
  description: string;
  note?: string;
};

export type ExpenseList = {
  expenses: BranchExpense[];
  branches: ExpenseBranch[];
  scopedBranchId: number | null;
  summary: {
    total: number;
    draft: number;
    pending: number;
    pendingAmount: number;
    approved: number;
    approvedAmount: number;
    rejected: number;
    byCategory: Record<ExpenseCategory, number>;
  };
};

export type ExpenseFilters = {
  branchId?: number;
  status?: ExpenseStatus | "ALL";
  category?: ExpenseCategory | "ALL";
  from?: string;
  to?: string;
  q?: string;
};
