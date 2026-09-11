import type {
  BranchExpense,
  ExpenseFilters,
  ExpenseInput,
  ExpenseList,
} from "@/types/expense";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function apiUrl() {
  if (!API_URL) throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  return API_URL;
}

function headers(accessToken: string) {
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

export async function getExpenses(
  accessToken: string,
  filters: ExpenseFilters = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (filters.branchId) params.set("branchId", String(filters.branchId));
  if (filters.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }
  if (filters.category && filters.category !== "ALL") {
    params.set("category", filters.category);
  }
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  const response = await fetch(`${apiUrl()}/expenses?${params.toString()}`, {
    headers: headers(accessToken),
    cache: "no-store",
    signal,
  });
  return read<ExpenseList>(response, "Không thể tải danh sách khoản chi");
}

export async function createExpense(
  accessToken: string,
  input: ExpenseInput,
) {
  const response = await fetch(`${apiUrl()}/expenses`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<BranchExpense>(response, "Không thể tạo khoản chi");
}

export async function updateExpense(
  accessToken: string,
  id: number,
  input: ExpenseInput,
) {
  const response = await fetch(`${apiUrl()}/expenses/${id}`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<BranchExpense>(response, "Không thể cập nhật khoản chi");
}

async function expenseAction(
  accessToken: string,
  id: number,
  action: "submit" | "cancel",
) {
  const response = await fetch(`${apiUrl()}/expenses/${id}/${action}`, {
    method: "POST",
    headers: headers(accessToken),
  });
  return read<BranchExpense>(response, "Không thể cập nhật khoản chi");
}

export function submitExpense(accessToken: string, id: number) {
  return expenseAction(accessToken, id, "submit");
}

export function cancelExpense(accessToken: string, id: number) {
  return expenseAction(accessToken, id, "cancel");
}

export async function reviewExpense(
  accessToken: string,
  id: number,
  input: { decision: "APPROVE" | "REJECT"; note?: string },
) {
  const response = await fetch(`${apiUrl()}/expenses/${id}/review`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<BranchExpense>(response, "Không thể duyệt khoản chi");
}
