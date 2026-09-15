import type { ProfitabilityReport } from "@/types/profitability";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  return API_URL;
}

export async function getProfitabilityReport(
  accessToken: string,
  filters: { branchId?: number; from: string; to: string },
  signal?: AbortSignal,
): Promise<ProfitabilityReport> {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.branchId) params.set("branchId", String(filters.branchId));
  const response = await fetch(
    `${getApiUrl()}/profitability/report?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal,
    },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể tải báo cáo lợi nhuận");
  }
  return data;
}
