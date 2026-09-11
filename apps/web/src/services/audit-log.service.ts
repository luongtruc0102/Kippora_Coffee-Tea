import type {
  AuditLogFilters,
  AuditLogsResponse,
} from "@/types/audit-log";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getAuditLogs(
  accessToken: string,
  filters: AuditLogFilters,
  signal?: AbortSignal,
) {
  if (!API_URL) throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  const params = new URLSearchParams();
  if (filters.branchId) params.set("branchId", String(filters.branchId));
  if (filters.module) params.set("module", filters.module);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  params.set("page", String(filters.page || 1));
  params.set("limit", String(filters.limit || 30));

  const response = await fetch(`${API_URL}/audit-logs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;
    throw new Error(message || "Không thể tải nhật ký hoạt động");
  }
  return data as AuditLogsResponse;
}
