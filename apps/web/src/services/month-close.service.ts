import type { MonthCloseOverview } from "@/types/month-close";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  return API_URL;
}

async function readResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || fallback);
  return data as T;
}

export async function getMonthCloseOverview(
  accessToken: string,
  month: string,
  branchId?: number,
  signal?: AbortSignal,
): Promise<MonthCloseOverview> {
  const params = new URLSearchParams({ month });
  if (branchId) params.set("branchId", String(branchId));
  const response = await fetch(
    `${getApiUrl()}/month-close/overview?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal,
    },
  );
  return readResponse(response, "Không thể tải dữ liệu chốt sổ tháng");
}

export async function closeMonth(
  accessToken: string,
  payload: { month: string; branchId: number; note?: string },
) {
  const response = await fetch(`${getApiUrl()}/month-close/close`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return readResponse<{ id: number; status: "CLOSED"; version: number }>(
    response,
    "Không thể chốt sổ tháng",
  );
}

export async function reopenMonth(
  accessToken: string,
  payload: { month: string; branchId: number; reason: string },
) {
  const response = await fetch(`${getApiUrl()}/month-close/reopen`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return readResponse<{ id: number; status: "OPEN"; version: number }>(
    response,
    "Không thể mở lại kỳ kế toán",
  );
}
