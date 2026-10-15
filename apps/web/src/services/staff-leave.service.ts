import type {
  BranchLeaveRequests,
  CreateStaffLeaveInput,
  MyLeaveSchedule,
  ReviewStaffLeaveInput,
  StaffLeaveRequest,
  StaffLeaveStatus,
  ShiftCoverageCandidate,
} from "@/types/staff-leave";

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

export async function getMyLeaveSchedule(
  accessToken: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`${apiUrl()}/staff-leaves/me`, {
    headers: headers(accessToken),
    cache: "no-store",
    signal,
  });
  return readResponse<MyLeaveSchedule>(
    response,
    "Không thể tải ca làm của bạn",
  );
}

export async function createStaffLeave(
  accessToken: string,
  input: CreateStaffLeaveInput,
) {
  const response = await fetch(`${apiUrl()}/staff-leaves`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return readResponse<StaffLeaveRequest>(
    response,
    "Không thể gửi yêu cầu nghỉ",
  );
}

export async function supplementStaffLeave(
  accessToken: string,
  requestId: number,
  input: { reason: string; evidenceUrl?: string },
) {
  const response = await fetch(
    `${apiUrl()}/staff-leaves/${requestId}/supplement`,
    {
      method: "PATCH",
      headers: headers(accessToken),
      body: JSON.stringify(input),
    },
  );
  return readResponse<StaffLeaveRequest>(response, "Không thể bổ sung yêu cầu");
}

export async function cancelStaffLeave(accessToken: string, requestId: number) {
  const response = await fetch(`${apiUrl()}/staff-leaves/${requestId}/cancel`, {
    method: "PATCH",
    headers: headers(accessToken),
  });
  return readResponse<StaffLeaveRequest>(
    response,
    "Không thể hủy yêu cầu nghỉ",
  );
}

export async function getBranchLeaveRequests(
  accessToken: string,
  status?: StaffLeaveStatus,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const suffix = params.size ? `?${params.toString()}` : "";
  const response = await fetch(`${apiUrl()}/staff-leaves/branch${suffix}`, {
    headers: headers(accessToken),
    cache: "no-store",
    signal,
  });
  return readResponse<BranchLeaveRequests>(
    response,
    "Không thể tải yêu cầu nghỉ",
  );
}

export async function reviewStaffLeave(
  accessToken: string,
  requestId: number,
  input: ReviewStaffLeaveInput,
) {
  const response = await fetch(`${apiUrl()}/staff-leaves/${requestId}/review`, {
    method: "PATCH",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return readResponse<StaffLeaveRequest>(
    response,
    "Không thể xử lý yêu cầu nghỉ",
  );
}

export async function getShiftCoverageCandidates(
  accessToken: string,
  requestId: number,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${apiUrl()}/staff-leaves/${requestId}/coverage-candidates`,
    {
      headers: headers(accessToken),
      cache: "no-store",
      signal,
    },
  );
  return readResponse<ShiftCoverageCandidate[]>(
    response,
    "Không thể tải nhân viên ca trước",
  );
}

export async function assignShiftCoverage(
  accessToken: string,
  requestId: number,
  coveringEmployeeId: number,
) {
  const response = await fetch(
    apiUrl() + "/staff-leaves/" + requestId + "/coverage",
    {
      method: "PATCH",
      headers: headers(accessToken),
      body: JSON.stringify({ coveringEmployeeId }),
    },
  );
  return readResponse<StaffLeaveRequest>(
    response,
    "Không thể phân công lại người làm thay",
  );
}

export async function respondShiftCoverage(
  accessToken: string,
  coverageId: number,
  action: "ACCEPTED" | "DECLINED",
) {
  const response = await fetch(
    `${apiUrl()}/staff-leaves/coverages/${coverageId}/respond`,
    {
      method: "PATCH",
      headers: headers(accessToken),
      body: JSON.stringify({ action }),
    },
  );
  return readResponse<{ id: number; status: string }>(
    response,
    "Không thể phản hồi phân công làm thay",
  );
}

export async function uploadLeaveEvidence(accessToken: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${apiUrl()}/uploads/leave-evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  return readResponse<{ evidenceUrl: string }>(
    response,
    "Không thể tải minh chứng",
  );
}

/** Mở file riêng tư bằng Access Token thay vì để trình duyệt truy cập URL công khai. */
export async function openLeaveEvidence(
  accessToken: string,
  evidenceUrl: string,
) {
  const previewWindow = window.open("", "_blank");
  if (previewWindow) {
    previewWindow.opener = null;
    previewWindow.document.title = "Đang tải minh chứng...";
    previewWindow.document.body.textContent = "Đang tải minh chứng...";
  }

  try {
    const response = await fetch(evidenceUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || "Không thể mở minh chứng");
    }

    const objectUrl = URL.createObjectURL(await response.blob());
    if (previewWindow) {
      previewWindow.location.replace(objectUrl);
    } else {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60 * 1000);
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}
