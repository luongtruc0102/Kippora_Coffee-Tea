import type {
  BranchStatus,
  CreateBranchInput,
  StoreSettings,
  StoreStatus,
  UpdateBranchInput,
  UpdateStoreSettingsInput,
} from "@/types/store-settings";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) {
    throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  }

  return API_URL;
}

function getHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function readResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    throw new Error(message || fallbackMessage);
  }

  return data as T;
}

// Trạng thái công khai đã kết hợp hệ thống, chi nhánh và giờ hoạt động.
export async function getStoreStatus(
  signal?: AbortSignal,
): Promise<StoreStatus> {
  const response = await fetch(`${getApiUrl()}/store/status`, {
    cache: "no-store",
    signal,
  });

  return readResponse<StoreStatus>(
    response,
    "Không thể tải trạng thái cửa hàng",
  );
}

export async function getStoreSettings(
  accessToken: string,
  signal?: AbortSignal,
): Promise<StoreSettings> {
  const response = await fetch(`${getApiUrl()}/store/settings`, {
    headers: getHeaders(accessToken),
    cache: "no-store",
    signal,
  });

  return readResponse<StoreSettings>(
    response,
    "Không thể tải cài đặt cửa hàng",
  );
}

// Admin lấy danh sách toàn bộ chi nhánh.
export async function getBranches(
  accessToken: string,
  signal?: AbortSignal,
): Promise<BranchStatus[]> {
  const response = await fetch(`${getApiUrl()}/store/branches`, {
    headers: getHeaders(accessToken),
    cache: "no-store",
    signal,
  });

  return readResponse<BranchStatus[]>(
    response,
    "Không thể tải danh sách chi nhánh",
  );
}

export async function createBranch(
  accessToken: string,
  input: CreateBranchInput,
): Promise<BranchStatus> {
  const response = await fetch(`${getApiUrl()}/store/branches`, {
    method: "POST",
    headers: getHeaders(accessToken),
    body: JSON.stringify(input),
  });

  return readResponse<BranchStatus>(response, "Không thể tạo chi nhánh");
}

export async function updateBranch(
  accessToken: string,
  id: number,
  input: UpdateBranchInput,
): Promise<BranchStatus> {
  const response = await fetch(`${getApiUrl()}/store/branches/${id}`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
    body: JSON.stringify(input),
  });

  return readResponse<BranchStatus>(response, "Không thể cập nhật chi nhánh");
}

export async function updateBranchActive(
  accessToken: string,
  id: number,
  isActive: boolean,
): Promise<BranchStatus> {
  const response = await fetch(`${getApiUrl()}/store/branches/${id}/status`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
    body: JSON.stringify({ isActive }),
  });

  return readResponse<BranchStatus>(
    response,
    "Không thể đổi trạng thái chi nhánh",
  );
}

// Admin phân công một Staff đang hoạt động làm trưởng chi nhánh.
export async function assignBranchManager(
  accessToken: string,
  branchId: number,
  userId: number,
): Promise<BranchStatus> {
  const response = await fetch(
    `${getApiUrl()}/store/branches/${branchId}/manager`,
    {
      method: "PATCH",
      headers: getHeaders(accessToken),
      body: JSON.stringify({ userId }),
    },
  );

  return readResponse<BranchStatus>(
    response,
    "Không thể phân công trưởng chi nhánh",
  );
}

// Admin gỡ quyền trưởng; tài khoản được đưa về role STAFF.
export async function removeBranchManager(
  accessToken: string,
  branchId: number,
): Promise<BranchStatus> {
  const response = await fetch(
    `${getApiUrl()}/store/branches/${branchId}/manager`,
    {
      method: "DELETE",
      headers: getHeaders(accessToken),
    },
  );

  return readResponse<BranchStatus>(response, "Không thể gỡ trưởng chi nhánh");
}
// Staff xem trạng thái nhận đơn của chi nhánh đang vận hành.
export async function getBranchStatus(
  accessToken: string,
  signal?: AbortSignal,
): Promise<BranchStatus> {
  const response = await fetch(`${getApiUrl()}/store/branch-status`, {
    headers: getHeaders(accessToken),
    cache: "no-store",
    signal,
  });

  return readResponse<BranchStatus>(
    response,
    "Không thể tải trạng thái chi nhánh",
  );
}

// Staff tạm nghỉ/mở nhận đơn cho chi nhánh, không đóng toàn hệ thống.
export async function updateBranchStatus(
  accessToken: string,
  isAcceptingOrders: boolean,
  pauseReason?: string,
): Promise<BranchStatus> {
  const response = await fetch(`${getApiUrl()}/store/branch-status`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
    body: JSON.stringify({
      isAcceptingOrders,
      pauseReason: isAcceptingOrders ? null : pauseReason,
    }),
  });

  return readResponse<BranchStatus>(
    response,
    "Không thể đổi trạng thái chi nhánh",
  );
}

export async function updateStoreSettings(
  accessToken: string,
  input: UpdateStoreSettingsInput,
): Promise<StoreSettings> {
  const response = await fetch(`${getApiUrl()}/store/settings`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
    body: JSON.stringify(input),
  });

  return readResponse<StoreSettings>(
    response,
    "Không thể cập nhật cài đặt cửa hàng",
  );
}

// API nhanh cấp hệ thống; backend chỉ cho phép ADMIN gọi.
export async function updateAcceptingOrders(
  accessToken: string,
  isAcceptingOrders: boolean,
  pauseReason?: string,
): Promise<StoreSettings> {
  const response = await fetch(`${getApiUrl()}/store/accepting-orders`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
    body: JSON.stringify({
      isAcceptingOrders,
      pauseReason: isAcceptingOrders ? null : pauseReason,
    }),
  });

  return readResponse<StoreSettings>(
    response,
    "Không thể đổi trạng thái nhận đơn",
  );
}

export const STORE_STATUS_UPDATED_EVENT = "store-status-updated";

export function announceStoreStatusUpdated() {
  window.dispatchEvent(new Event(STORE_STATUS_UPDATED_EVENT));
}
