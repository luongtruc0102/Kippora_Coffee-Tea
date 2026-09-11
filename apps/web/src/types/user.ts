export type UserRole = "ADMIN" | "BRANCH_MANAGER" | "STAFF" | "USER";

export type AdminUser = {
  id: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  address: string | null;

  loyaltyPoints: number;
  isActive: boolean;

  role: {
    name: UserRole;
  };

  branch?: {
    id: number;
    code: string;
    name: string;
  } | null;

  createdAt: string;
  updatedAt: string;
  lastPurchaseAt?: string | null;

  // Chỉ có trong chi tiết nhân viên; tổng giây của các ca đã kết thúc.
  totalWorkedSeconds?: number;

  purchaseSummary?: {
    totalOrders: number;
    totalSpent: number;
    lastPurchaseAt: string | null;
  };

  recentOrders?: {
    id: number;
    totalPrice: number | string;
    status:
      | "PENDING"
      | "CONFIRMED"
      | "PREPARING"
      | "READY_FOR_PICKUP"
      | "DELIVERING"
      | "COMPLETED"
      | "CANCELLED";
    createdAt: string;
  }[];
};

export type CreateStaffInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  branchId: number;
};
export type BranchStaff = {
  id: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  loyaltyPoints: number;
  isActive: boolean;
  totalWorkedSeconds: number;
  role: { name: "STAFF" };
  branch: {
    id: number;
    code: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBranchStaffInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

export type StaffAttendance = {
  id: number;
  employeeId: number;
  branchId: number;
  recordedById: number | null;
  scheduledShiftId: number | null;
  clockIn: string;
  clockOut: string | null;
  autoClockIn: boolean;
  autoClockOut: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  scheduledShift: {
    id: number;
    startAt: string;
    endAt: string;
  } | null;
  employee: {
    id: number;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    phone: string | null;
    isActive: boolean;
  };
};
