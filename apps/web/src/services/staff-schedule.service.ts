import type {
  AttendanceReport,
  AttendancePeriod,
  MyScheduleStatus,
  SaveStaffShiftInput,
  StaffScheduleWeek,
  StaffShift,
  UpdateStaffShiftInput,
  UpdateStaffShiftTemplatesInput,
  StaffShiftTemplate,
  UpdateStaffAttendanceInput,
} from "@/types/staff-schedule";

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

export async function getStaffScheduleWeek(
  accessToken: string,
  weekStart: string,
  branchId?: number,
  signal?: AbortSignal,
): Promise<StaffScheduleWeek> {
  const params = new URLSearchParams({ weekStart });
  if (branchId) params.set("branchId", String(branchId));
  const response = await fetch(
    `${getApiUrl()}/staff-schedules/week?${params.toString()}`,
    { headers: getHeaders(accessToken), cache: "no-store", signal },
  );
  return readResponse(response, "Không thể tải lịch làm việc");
}

export async function createStaffShift(
  accessToken: string,
  input: SaveStaffShiftInput,
): Promise<StaffShift> {
  const response = await fetch(`${getApiUrl()}/staff-schedules`, {
    method: "POST",
    headers: getHeaders(accessToken),
    body: JSON.stringify(input),
  });
  return readResponse(response, "Không thể xếp ca làm");
}

export async function updateStaffShift(
  accessToken: string,
  id: number,
  input: UpdateStaffShiftInput,
): Promise<StaffShift> {
  const response = await fetch(`${getApiUrl()}/staff-schedules/${id}`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
    body: JSON.stringify(input),
  });
  return readResponse(response, "Không thể cập nhật ca làm");
}

export async function deleteStaffShift(
  accessToken: string,
  id: number,
): Promise<void> {
  const response = await fetch(`${getApiUrl()}/staff-schedules/${id}`, {
    method: "DELETE",
    headers: getHeaders(accessToken),
  });
  await readResponse(response, "Không thể xóa ca làm");
}

export async function getMyScheduleStatus(
  accessToken: string,
  signal?: AbortSignal,
): Promise<MyScheduleStatus> {
  const response = await fetch(`${getApiUrl()}/staff-schedules/me/status`, {
    headers: getHeaders(accessToken),
    cache: "no-store",
    signal,
  });
  return readResponse(response, "Không thể tải ca làm sắp tới");
}

export async function updateStaffShiftTemplates(
  accessToken: string,
  branchId: number,
  templates: UpdateStaffShiftTemplatesInput,
): Promise<StaffShiftTemplate[]> {
  const response = await fetch(`${getApiUrl()}/staff-schedules/templates`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
    body: JSON.stringify({ branchId, templates }),
  });
  return readResponse(response, "Không thể cập nhật giờ hoạt động của ca");
}

export async function getAttendanceReport(
  accessToken: string,
  startDate: string,
  endDate: string,
  branchId?: number,
  signal?: AbortSignal,
): Promise<AttendanceReport> {
  const params = new URLSearchParams({ startDate, endDate });
  if (branchId) params.set("branchId", String(branchId));
  const response = await fetch(
    `${getApiUrl()}/staff-schedules/attendance-report?${params.toString()}`,
    { headers: getHeaders(accessToken), cache: "no-store", signal },
  );
  return readResponse(response, "Không thể tải bảng công");
}

export async function getMyAttendanceReport(
  accessToken: string,
  month: string,
  signal?: AbortSignal,
): Promise<AttendanceReport> {
  const params = new URLSearchParams({ month });
  const response = await fetch(
    `${getApiUrl()}/staff-schedules/me/attendance-report?${params.toString()}`,
    { headers: getHeaders(accessToken), cache: "no-store", signal },
  );
  return readResponse(response, "Không thể tải bảng công của bạn");
}

export async function updateStaffAttendance(
  accessToken: string,
  attendanceId: number,
  input: UpdateStaffAttendanceInput,
): Promise<void> {
  const response = await fetch(
    `${getApiUrl()}/staff-schedules/attendance/${attendanceId}`,
    {
      method: "PATCH",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
  await readResponse(response, "Không thể điều chỉnh chấm công");
}

export async function getAttendancePeriod(
  accessToken: string,
  month: string,
  branchId?: number,
  signal?: AbortSignal,
): Promise<AttendancePeriod> {
  const params = new URLSearchParams({ month });
  if (branchId) params.set("branchId", String(branchId));
  const response = await fetch(
    `${getApiUrl()}/staff-schedules/attendance-period?${params.toString()}`,
    { headers: getHeaders(accessToken), cache: "no-store", signal },
  );
  return readResponse(response, "Không thể tải trạng thái duyệt bảng công");
}

export async function submitAttendancePeriod(
  accessToken: string,
  month: string,
): Promise<AttendancePeriod> {
  const response = await fetch(
    `${getApiUrl()}/staff-schedules/attendance-period/submit`,
    {
      method: "POST",
      headers: getHeaders(accessToken),
      body: JSON.stringify({ month }),
    },
  );
  return readResponse(response, "Không thể gửi bảng công cho Admin");
}

export async function reviewAttendancePeriod(
  accessToken: string,
  periodId: number,
  input: { action: "APPROVE" | "RETURN"; note?: string },
): Promise<AttendancePeriod> {
  const response = await fetch(
    `${getApiUrl()}/staff-schedules/attendance-periods/${periodId}/review`,
    {
      method: "PATCH",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
  return readResponse(response, "Không thể xử lý bảng công");
}

export async function reopenAttendancePeriod(
  accessToken: string,
  periodId: number,
  reason: string,
): Promise<AttendancePeriod> {
  const response = await fetch(
    `${getApiUrl()}/staff-schedules/attendance-periods/${periodId}/reopen`,
    {
      method: "PATCH",
      headers: getHeaders(accessToken),
      body: JSON.stringify({ reason }),
    },
  );
  return readResponse(response, "Không thể mở lại bảng công");
}
