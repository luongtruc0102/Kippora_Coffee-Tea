import type { PaymentStatus } from "./order";

export type BankTransferInstruction = {
  paymentId: number;
  orderId: number;
  status: PaymentStatus;
  amount: number;
  referenceCode: string;
  expiresAt: string | null;
  serverTime: string;
  qrPayload: string;
  bankAccount: {
    bankBin: string;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
};

export type BranchBankAccount = {
  id: number;
  branchId: number;
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BankAccountBranch = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  bankAccount: BranchBankAccount | null;
};

export type BankTransactionStatus =
  "UNMATCHED" | "MATCHED" | "AMOUNT_MISMATCH" | "DUPLICATE" | "IGNORED";

export type PendingBankPayment = {
  id: number;
  orderId: number;
  amount: number;
  referenceCode: string | null;
  createdAt: string;
  order: {
    id: number;
    branchId: number;
    receiverName: string;
    receiverPhone: string;
    branch: { code: string; name: string };
  };
};

export type BankTransaction = {
  id: number;
  providerReference: string;
  amount: number;
  description: string;
  occurredAt: string;
  status: BankTransactionStatus;
  matchedPaymentId: number | null;
  matchedAt: string | null;
  resolutionNote: string | null;
  bankAccount: BranchBankAccount & {
    branch: { id: number; code: string; name: string };
  };
  suggestedPayment: (PendingBankPayment & { status?: PaymentStatus }) | null;
  resolvedBy: {
    id: number;
    email: string;
    profile: { fullName: string | null } | null;
  } | null;
};

export type BankReconciliationResult = {
  range: { from: string; to: string };
  summary: {
    totalCount: number;
    totalAmount: number;
    matchedCount: number;
    matchedAmount: number;
    unresolvedCount: number;
    unresolvedAmount: number;
  };
  transactions: BankTransaction[];
  pendingPayments: PendingBankPayment[];
};

export type BankAccountInput = {
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
};
