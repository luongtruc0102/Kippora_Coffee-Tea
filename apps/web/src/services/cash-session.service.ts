import type {
  CashSession,
  CashSessionFilters,
  CashSessionList,
} from "@/types/cash-session";

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

export async function getCashSessions(
  accessToken: string,
  filters: CashSessionFilters,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (filters.branchId) params.set("branchId", String(filters.branchId));
  if (filters.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const response = await fetch(
    `${apiUrl()}/cash-sessions?${params.toString()}`,
    { headers: headers(accessToken), cache: "no-store", signal },
  );
  return read<CashSessionList>(response, "Không thể tải danh sách sổ quỹ");
}

export async function getCashSession(accessToken: string, id: number) {
  const response = await fetch(`${apiUrl()}/cash-sessions/${id}`, {
    headers: headers(accessToken),
    cache: "no-store",
  });
  return read<CashSession>(response, "Không thể tải sổ quỹ");
}

export async function openCashSession(
  accessToken: string,
  input: { branchId: number; openingFloat: number; note?: string },
) {
  const response = await fetch(`${apiUrl()}/cash-sessions/open`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<CashSession>(response, "Không thể mở sổ quỹ");
}

export async function closeCashSession(
  accessToken: string,
  id: number,
  input: { actualCash: number; note?: string },
) {
  const response = await fetch(`${apiUrl()}/cash-sessions/${id}/close`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<CashSession>(response, "Không thể đóng sổ quỹ");
}

export async function approveCashSession(
  accessToken: string,
  id: number,
  note?: string,
) {
  const response = await fetch(`${apiUrl()}/cash-sessions/${id}/approve`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({ note }),
  });
  return read<CashSession>(response, "Không thể duyệt sổ quỹ");
}

export async function reopenCashSession(
  accessToken: string,
  id: number,
  reason: string,
) {
  const response = await fetch(`${apiUrl()}/cash-sessions/${id}/reopen`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({ reason }),
  });
  return read<CashSession>(response, "Không thể mở lại sổ quỹ");
}
