import type {
  CreatePayrollAdjustmentInput,
  PayrollPaymentMethod,
  PayrollReport,
  UpdatePayrollRoleRatesInput,
  UpdatePayrollRoleRatesResult,
} from "@/types/payroll";

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

async function readResponse<T>(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;
    throw new Error(message || fallback);
  }
  return data as T;
}

export async function generatePayroll(
  accessToken: string,
  month: string,
  branchId?: number,
  signal?: AbortSignal,
) {
  const response = await fetch(`${getApiUrl()}/payroll/generate`, {
    method: "POST",
    headers: getHeaders(accessToken),
    body: JSON.stringify({ month, ...(branchId ? { branchId } : {}) }),
    cache: "no-store",
    signal,
  });
  return readResponse<PayrollReport>(response, "Không thể tải bảng lương");
}

export async function getMyPayroll(
  accessToken: string,
  month: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ month });
  const response = await fetch(
    `${getApiUrl()}/payroll/me?${params.toString()}`,
    {
      headers: getHeaders(accessToken),
      cache: "no-store",
      signal,
    },
  );
  return readResponse<PayrollReport>(response, "Không thể tải phiếu lương");
}

export async function updatePayrollRoleRates(
  accessToken: string,
  input: UpdatePayrollRoleRatesInput,
) {
  const response = await fetch(`${getApiUrl()}/payroll/role-rates`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
    body: JSON.stringify(input),
  });
  return readResponse<UpdatePayrollRoleRatesResult>(
    response,
    "Không thể cập nhật lương chung",
  );
}

export async function createPayrollAdjustment(
  accessToken: string,
  entryId: number,
  input: CreatePayrollAdjustmentInput,
) {
  const response = await fetch(
    `${getApiUrl()}/payroll/entries/${entryId}/adjustments`,
    {
      method: "POST",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
  return readResponse<PayrollReport>(
    response,
    "Không thể thêm khoản điều chỉnh",
  );
}

export async function deletePayrollAdjustment(
  accessToken: string,
  adjustmentId: number,
) {
  const response = await fetch(
    `${getApiUrl()}/payroll/adjustments/${adjustmentId}`,
    { method: "DELETE", headers: getHeaders(accessToken) },
  );
  return readResponse<PayrollReport>(
    response,
    "Không thể xóa khoản điều chỉnh",
  );
}

export async function finalizePayroll(accessToken: string, periodId: number) {
  const response = await fetch(
    `${getApiUrl()}/payroll/periods/${periodId}/finalize`,
    { method: "POST", headers: getHeaders(accessToken) },
  );
  return readResponse<PayrollReport>(response, "Không thể chốt bảng lương");
}

export async function markPayrollPaid(
  accessToken: string,
  periodId: number,
  input: { method: PayrollPaymentMethod; reference?: string },
) {
  const response = await fetch(
    `${getApiUrl()}/payroll/periods/${periodId}/mark-paid`,
    {
      method: "POST",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
  return readResponse<PayrollReport>(
    response,
    "Không thể xác nhận thanh toán lương",
  );
}
