import type {
  AdminUser,
  BranchStaff,
  CreateBranchStaffInput,
  CreateStaffInput,
  StaffAttendance,
} from "@/types/user";

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

export async function getAdminUsers(
  accessToken: string,
  query = "",
  signal?: AbortSignal,
): Promise<AdminUser[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());

  const url = `${getApiUrl()}/users?${params.toString()}`;

  const response = await fetch(url, {
    headers: getHeaders(accessToken),

    cache: "no-store",
    signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không thể tải người dùng");
  }

  return data;
}

export async function getAdminUserById(
  accessToken: string,
  userId: number,
): Promise<AdminUser> {
  const response = await fetch(`${getApiUrl()}/users/${userId}`, {
    headers: getHeaders(accessToken),

    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không thể tải thông tin người dùng");
  }

  return data;
}

export async function createStaff(
  accessToken: string,
  input: CreateStaffInput,
): Promise<AdminUser> {
  const response = await fetch(`${getApiUrl()}/users/staff`, {
    method: "POST",

    headers: getHeaders(accessToken),

    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;

    throw new Error(message || "Không thể tạo nhân viên");
  }

  return data;
}

export async function updateUserStatus(
  accessToken: string,
  userId: number,
  isActive: boolean,
): Promise<AdminUser> {
  const response = await fetch(`${getApiUrl()}/users/${userId}/status`, {
    method: "PATCH",

    headers: getHeaders(accessToken),

    body: JSON.stringify({
      isActive,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không thể cập nhật trạng thái người dùng");
  }

  return data;
}

// Admin cập nhật đồng thời vai trò và chi nhánh để hai quan hệ luôn nhất quán.
export async function updateStaffAssignment(
  accessToken: string,
  userId: number,
  input: {
    branchId: number;
    role: "STAFF" | "BRANCH_MANAGER";
  },
): Promise<AdminUser> {
  const response = await fetch(
    `${getApiUrl()}/users/staff/${userId}/assignment`,
    {
      method: "PATCH",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;

    throw new Error(message || "Không thể cập nhật phân công nhân viên");
  }

  return data;
}
export async function getBranchStaff(
  accessToken: string,
  query = "",
  signal?: AbortSignal,
): Promise<BranchStaff[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  const response = await fetch(
    `${getApiUrl()}/users/branch/staff?${params.toString()}`,
    { headers: getHeaders(accessToken), cache: "no-store", signal },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể tải nhân viên chi nhánh");
  }
  return data;
}

export async function createBranchStaff(
  accessToken: string,
  input: CreateBranchStaffInput,
): Promise<BranchStaff> {
  const response = await fetch(`${getApiUrl()}/users/branch/staff`, {
    method: "POST",
    headers: getHeaders(accessToken),
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;
    throw new Error(message || "Không thể tạo nhân viên chi nhánh");
  }
  return data;
}

export async function updateBranchStaffStatus(
  accessToken: string,
  userId: number,
  isActive: boolean,
): Promise<BranchStaff> {
  const response = await fetch(
    `${getApiUrl()}/users/branch/staff/${userId}/status`,
    {
      method: "PATCH",
      headers: getHeaders(accessToken),
      body: JSON.stringify({ isActive }),
    },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể cập nhật trạng thái nhân viên");
  }
  return data;
}

export async function getTodayBranchAttendance(
  accessToken: string,
  signal?: AbortSignal,
): Promise<StaffAttendance[]> {
  const response = await fetch(
    `${getApiUrl()}/users/branch/staff/attendance/today`,
    { headers: getHeaders(accessToken), cache: "no-store", signal },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể tải dữ liệu chấm công");
  }
  return data;
}

// Nhân viên thường lấy ca đang mở của chính mình để đồng bộ nút điểm danh.
export async function getMyCurrentAttendance(
  accessToken: string,
  signal?: AbortSignal,
): Promise<StaffAttendance | null> {
  const response = await fetch(
    `${getApiUrl()}/users/me/attendance/current`,
    { headers: getHeaders(accessToken), cache: "no-store", signal },
  );
  // Nest trả body rỗng khi service trả null (nhân viên chưa điểm danh).
  // Không gọi response.json() trực tiếp vì body rỗng sẽ làm hỏng cả luồng
  // tải lịch và khiến nút điểm danh hiểu nhầm thành "Chưa có ca".
  const body = await response.text();
  const data = body ? (JSON.parse(body) as StaffAttendance) : null;
  if (!response.ok) {
    const message = data as unknown as { message?: string } | null;
    throw new Error(message?.message || "Không thể tải trạng thái ca làm");
  }
  return data;
}

// Nhân viên tự điểm danh; việc kết thúc ca do trưởng chi nhánh thực hiện.
export async function checkInMyAttendance(
  accessToken: string,
): Promise<StaffAttendance> {
  const response = await fetch(
    `${getApiUrl()}/users/me/attendance/check-in`,
    { method: "POST", headers: getHeaders(accessToken) },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể điểm danh");
  }
  return data;
}

export async function checkInBranchStaff(
  accessToken: string,
  userId: number,
): Promise<StaffAttendance> {
  const response = await fetch(
    `${getApiUrl()}/users/branch/staff/${userId}/attendance/check-in`,
    { method: "POST", headers: getHeaders(accessToken) },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể bắt đầu ca làm");
  }
  return data;
}

export async function checkOutBranchStaff(
  accessToken: string,
  userId: number,
): Promise<StaffAttendance> {
  const response = await fetch(
    `${getApiUrl()}/users/branch/staff/${userId}/attendance/check-out`,
    { method: "PATCH", headers: getHeaders(accessToken) },
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể kết thúc ca làm");
  }
  return data;
}
