import type { PaymentStatus } from "@/types/order";
import type { ManagedPayment } from "@/types/payment";

export type PaymentMethodFilter = "ALL" | "CASH" | "COD" | "BANK_TRANSFER";

export type PaymentFilters = {
  search: string;
  branchId: string;
  method: PaymentMethodFilter;
  status: "ALL" | PaymentStatus;
  dateFrom: string;
  dateTo: string;
};

export type PaymentReportSnapshot = {
  payments: ManagedPayment[];
  filters: PaymentFilters;
  branchLabel: string;
  generatedAt: Date;
  timeZone: string;
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

export const paymentMethodLabels: Record<PaymentMethodFilter, string> = {
  ALL: "Tất cả phương thức",
  CASH: "Tiền mặt",
  COD: "COD",
  BANK_TRANSFER: "Chuyển khoản",
};

export function getPaymentMethodKey(
  payment: ManagedPayment,
): Exclude<PaymentMethodFilter, "ALL"> {
  if (payment.method === "BANK_TRANSFER") return "BANK_TRANSFER";
  return payment.order.channel === "POS" ? "CASH" : "COD";
}

export function getPaymentMethodLabel(payment: ManagedPayment) {
  return paymentMethodLabels[getPaymentMethodKey(payment)];
}

// Cùng quy ước với bảng: đã thu dùng paidAt; còn lại dùng createdAt.
export function getLocalPaymentDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function hasInvalidPaymentDateRange(filters: PaymentFilters) {
  return Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );
}

export function filterPayments(
  payments: ManagedPayment[],
  filters: PaymentFilters,
) {
  if (hasInvalidPaymentDateRange(filters)) return [];
  const search = filters.search.trim().toLowerCase();

  return payments.filter((payment) => {
    const date = getLocalPaymentDateKey(payment.paidAt || payment.createdAt);
    if (filters.dateFrom && date < filters.dateFrom) return false;
    if (filters.dateTo && date > filters.dateTo) return false;
    if (
      filters.branchId !== "ALL" &&
      payment.order.branch.id !== Number(filters.branchId)
    )
      return false;
    if (
      filters.method !== "ALL" &&
      getPaymentMethodKey(payment) !== filters.method
    )
      return false;
    if (filters.status !== "ALL" && payment.status !== filters.status)
      return false;
    if (!search) return true;

    return [
      String(payment.id),
      String(payment.orderId),
      payment.order.receiverName,
      payment.order.receiverPhone,
      payment.order.user.email,
      payment.transactionCode || "",
    ].some((value) => value.toLowerCase().includes(search));
  });
}

export function summarizePayments(payments: ManagedPayment[]) {
  // Cộng bằng đơn vị nhỏ nhất để tránh sai số khi dữ liệu Decimal có phần lẻ.
  let collected = 0;
  let cash = 0;
  let cod = 0;
  let bank = 0;
  let pending = 0;
  let paidCount = 0;
  let pendingCount = 0;

  for (const payment of payments) {
    const amount = Math.round(Number(payment.amount) * 100);
    if (!Number.isFinite(amount) || amount < 0) continue;
    if (payment.status === "PAID") {
      collected += amount;
      paidCount += 1;
      const method = getPaymentMethodKey(payment);
      if (method === "CASH") cash += amount;
      if (method === "COD") cod += amount;
      if (method === "BANK_TRANSFER") bank += amount;
    }
    if (payment.status === "PENDING") {
      pending += amount;
      pendingCount += 1;
    }
  }

  return {
    collectedAmount: collected / 100,
    cashAmount: cash / 100,
    codAmount: cod / 100,
    bankTransferAmount: bank / 100,
    pendingAmount: pending / 100,
    paidCount,
    pendingCount,
  };
}
