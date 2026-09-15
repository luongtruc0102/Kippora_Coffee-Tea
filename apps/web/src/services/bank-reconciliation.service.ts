import type {
  BankAccountBranch,
  BankAccountInput,
  BankReconciliationResult,
  BankTransaction,
  BankTransactionStatus,
  BankTransferInstruction,
  BranchBankAccount,
} from "@/types/bank-reconciliation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  return API_URL;
}

function getHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function read<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;
    throw new Error(message || fallback);
  }
  return data as T;
}

export async function getBankTransferInstruction(
  accessToken: string,
  target: { orderId: number } | { paymentId: number },
) {
  const path =
    "orderId" in target
      ? `/payments/orders/${target.orderId}/qr`
      : `/payments/management/${target.paymentId}/qr`;
  const response = await fetch(`${getApiUrl()}${path}`, {
    headers: getHeaders(accessToken),
    cache: "no-store",
  });
  return read<BankTransferInstruction>(response, "Không thể tải mã VietQR");
}

export async function getBankAccounts(accessToken: string) {
  const response = await fetch(
    `${getApiUrl()}/payments/management/bank-accounts/all`,
    { headers: getHeaders(accessToken), cache: "no-store" },
  );
  return read<BankAccountBranch[]>(
    response,
    "Không thể tải tài khoản ngân hàng",
  );
}

export async function saveBankAccount(
  accessToken: string,
  branchId: number,
  input: BankAccountInput,
) {
  const response = await fetch(
    `${getApiUrl()}/payments/management/bank-accounts/${branchId}`,
    {
      method: "PUT",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
  return read<BranchBankAccount>(response, "Không thể lưu tài khoản ngân hàng");
}

export async function getBankReconciliation(
  accessToken: string,
  filters: {
    branchId?: number;
    from: string;
    to: string;
    status?: BankTransactionStatus | "ALL";
  },
) {
  const query = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.branchId) query.set("branchId", String(filters.branchId));
  if (filters.status && filters.status !== "ALL") {
    query.set("status", filters.status);
  }
  const response = await fetch(
    `${getApiUrl()}/payments/management/reconciliation/list?${query.toString()}`,
    { headers: getHeaders(accessToken), cache: "no-store" },
  );
  return read<BankReconciliationResult>(
    response,
    "Không thể tải đối soát ngân hàng",
  );
}

export async function recordBankTransaction(
  accessToken: string,
  input: {
    bankBin: string;
    accountNumber: string;
    providerReference: string;
    amount: number;
    description: string;
    occurredAt: string;
  },
) {
  const response = await fetch(
    `${getApiUrl()}/payments/management/reconciliation/record`,
    {
      method: "POST",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
  return read<{ transaction: BankTransaction; duplicateDelivery: boolean }>(
    response,
    "Không thể ghi nhận giao dịch",
  );
}

export async function matchBankTransaction(
  accessToken: string,
  transactionId: number,
  paymentId: number,
  note: string,
) {
  const response = await fetch(
    `${getApiUrl()}/payments/management/reconciliation/${transactionId}/match`,
    {
      method: "POST",
      headers: getHeaders(accessToken),
      body: JSON.stringify({ paymentId, note }),
    },
  );
  return read<BankTransaction>(response, "Không thể ghép giao dịch");
}

export async function ignoreBankTransaction(
  accessToken: string,
  transactionId: number,
  reason: string,
) {
  const response = await fetch(
    `${getApiUrl()}/payments/management/reconciliation/${transactionId}/ignore`,
    {
      method: "POST",
      headers: getHeaders(accessToken),
      body: JSON.stringify({ reason }),
    },
  );
  return read<BankTransaction>(response, "Không thể bỏ qua giao dịch");
}
