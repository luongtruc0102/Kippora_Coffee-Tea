import type {
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseStatus,
} from "@/types/expense";

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  RENT: "Thuê mặt bằng",
  UTILITIES: "Điện, nước & dịch vụ",
  MAINTENANCE: "Bảo trì & sửa chữa",
  MARKETING: "Marketing",
  SUPPLIES: "Vật tư vận hành",
  TRANSPORT: "Vận chuyển",
  OTHER: "Chi phí khác",
};

export const expenseStatusLabels: Record<ExpenseStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ Admin duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
  CANCELLED: "Đã hủy",
};

export const expenseStatusClasses: Record<ExpenseStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export const expensePaymentMethodLabels: Record<
  ExpensePaymentMethod,
  string
> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

export function expenseCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function expenseDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function expenseDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
