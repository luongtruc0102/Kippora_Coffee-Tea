"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Hash,
  ReceiptText,
  UserRound,
  X,
} from "lucide-react";

import type { PaymentStatus } from "@/types/order";
import type { ManagedPayment, UpdatePaymentStatusInput } from "@/types/payment";

type Props = {
  open: boolean;
  payment: ManagedPayment | null;
  updating: boolean;
  onClose: () => void;
  onUpdate: (
    payment: ManagedPayment,
    input: UpdatePaymentStatusInput,
  ) => void | Promise<void>;
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return "Chưa ghi nhận";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getMethodLabel(payment: ManagedPayment) {
  if (payment.method === "BANK_TRANSFER") return "Chuyển khoản";
  return payment.order.channel === "POS" ? "Tiền mặt" : "COD";
}

function getStatusClass(status: PaymentStatus) {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-700";
    case "PAID":
      return "bg-emerald-100 text-emerald-700";
    case "FAILED":
      return "bg-red-100 text-red-600";
    case "CANCELLED":
      return "bg-[#EEEAE6] text-[#6E625B]";
    case "REFUNDED":
      return "bg-violet-100 text-violet-700";
  }
}

function getOrderStatusLabel(status: ManagedPayment["order"]["status"]) {
  const labels = {
    PENDING: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    PREPARING: "Đang pha chế",
    READY_FOR_PICKUP: "Chờ khách nhận",
    DELIVERING: "Đang giao",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã hủy",
  };

  return labels[status];
}

export default function PaymentDetailModal({
  open,
  payment,
  updating,
  onClose,
  onUpdate,
}: Props) {
  const [nextStatus, setNextStatus] = useState<PaymentStatus>("PAID");
  const [transactionCode, setTransactionCode] = useState("");
  const [formError, setFormError] = useState("");

  const allowedStatuses = useMemo<PaymentStatus[]>(() => {
    if (!payment) return [];
    if (payment.status === "PENDING") {
      return ["PAID", "FAILED", "CANCELLED"];
    }
    if (payment.status === "FAILED") return ["PENDING"];
    return [];
  }, [payment]);

  useEffect(() => {
    if (!open || !payment) return;

    const timeoutId = window.setTimeout(() => {
      const defaultStatus =
        payment.status === "FAILED" ? "PENDING" : allowedStatuses[0] || "PAID";

      setNextStatus(defaultStatus);
      setTransactionCode(payment.transactionCode || "");
      setFormError("");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [allowedStatuses, open, payment]);

  if (!open || !payment) return null;

  const currentPayment = payment;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (
      currentPayment.method === "BANK_TRANSFER" &&
      nextStatus === "PAID" &&
      !transactionCode.trim()
    ) {
      setFormError("Vui lòng nhập mã giao dịch chuyển khoản.");
      return;
    }

    setFormError("");

    await onUpdate(currentPayment, {
      status: nextStatus,
      transactionCode: transactionCode.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
        <div className="relative border-b border-[#E9E1D8] bg-gradient-to-r from-[#F7EFE6] via-[#FCF8F3] to-white px-7 py-6">
          <button
            type="button"
            disabled={updating}
            onClick={onClose}
            className="absolute right-5 top-5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[#78866B] shadow-sm hover:text-[#4A2C20] disabled:cursor-wait disabled:opacity-60"
          >
            <X size={19} />
          </button>

          <div className="flex items-start gap-4 pr-12">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#4A2C20] text-white shadow-sm">
              <CircleDollarSign size={27} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C9894B]">
                Thanh toán #{payment.id}
              </p>
              <h3 className="mt-1 text-2xl font-bold text-[#1F1B18]">
                {formatCurrency(payment.amount)}
              </h3>
              <span
                className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                  payment.status,
                )}`}
              >
                {paymentStatusLabels[payment.status]}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-7">
          <section>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#78866B]">
              Thông tin giao dịch
            </h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoCard
                icon={<CreditCard size={18} />}
                label="Phương thức"
                value={getMethodLabel(payment)}
              />
              <InfoCard
                icon={<Hash size={18} />}
                label="Mã giao dịch"
                value={payment.transactionCode || "Chưa có"}
              />
              <InfoCard
                icon={<CalendarClock size={18} />}
                label="Thời điểm thanh toán"
                value={formatDate(payment.paidAt)}
              />
            </div>
          </section>

          {payment.refund && (
            <section className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-violet-700">
                Chứng từ hoàn tiền
              </h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoCard
                  icon={<ReceiptText size={18} />}
                  label="Mã chứng từ"
                  value={payment.refund.code}
                />
                <InfoCard
                  icon={<Banknote size={18} />}
                  label="Số tiền hoàn"
                  value={formatCurrency(payment.refund.amount)}
                />
                <InfoCard
                  icon={<CreditCard size={18} />}
                  label="Phương thức hoàn"
                  value={
                    payment.refund.method === "CASH"
                      ? "Tiền mặt"
                      : "Chuyển khoản"
                  }
                />
                <InfoCard
                  icon={<CalendarClock size={18} />}
                  label="Thời gian hoàn"
                  value={formatDate(payment.refund.processedAt)}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-[#5E5650]">
                {payment.refund.reason}
              </p>
            </section>
          )}

          <section>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#78866B]">
              Đơn hàng liên quan
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={<ReceiptText size={18} />}
                label="Đơn hàng"
                value={`#${payment.order.id} · ${getOrderStatusLabel(
                  payment.order.status,
                )}`}
              />
              <InfoCard
                icon={<Banknote size={18} />}
                label="Kênh bán"
                value={
                  payment.order.channel === "POS"
                    ? "Bán tại quầy"
                    : "Đặt hàng online"
                }
              />
              <InfoCard
                icon={<UserRound size={18} />}
                label="Khách hàng"
                value={
                  payment.order.receiverPhone
                    ? `${payment.order.receiverName} · ${payment.order.receiverPhone}`
                    : payment.order.receiverName
                }
              />
              <InfoCard
                icon={<Building2 size={18} />}
                label="Chi nhánh"
                value={`${payment.order.branch.code} · ${payment.order.branch.name}`}
              />
            </div>
          </section>

          {allowedStatuses.length > 0 && (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF7] p-5"
            >
              <h4 className="text-sm font-semibold uppercase tracking-wide text-[#78866B]">
                Cập nhật trạng thái
              </h4>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="payment-next-status"
                    className="mb-2 block text-sm font-semibold text-[#4A2C20]"
                  >
                    Trạng thái mới
                  </label>
                  <select
                    id="payment-next-status"
                    value={nextStatus}
                    disabled={updating}
                    onChange={(event) => {
                      setNextStatus(event.target.value as PaymentStatus);
                      setFormError("");
                    }}
                    className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-white px-4 text-sm outline-none focus:border-[#C9894B] disabled:cursor-wait"
                  >
                    {allowedStatuses.map((status) => (
                      <option key={status} value={status}>
                        {paymentStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="payment-transaction-code"
                    className="mb-2 block text-sm font-semibold text-[#4A2C20]"
                  >
                    Mã giao dịch
                    {payment.method === "BANK_TRANSFER" && nextStatus === "PAID"
                      ? " *"
                      : ""}
                  </label>
                  <input
                    id="payment-transaction-code"
                    value={transactionCode}
                    disabled={updating}
                    onChange={(event) => {
                      setTransactionCode(event.target.value);
                      setFormError("");
                    }}
                    placeholder="Nhập khi xác nhận chuyển khoản"
                    className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-white px-4 text-sm outline-none focus:border-[#C9894B] disabled:cursor-wait"
                  />
                </div>
              </div>

              {formError && (
                <p className="mt-3 text-sm font-medium text-red-600">
                  {formError}
                </p>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={updating}
                  className="cursor-pointer rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#382118] disabled:cursor-wait disabled:opacity-60"
                >
                  {updating ? "Đang cập nhật..." : "Lưu trạng thái"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end border-t border-[#E9E1D8] bg-white px-7 py-4">
          <button
            type="button"
            disabled={updating}
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] hover:bg-[#FAF8F5] disabled:cursor-wait disabled:opacity-60"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#EEE5DC] bg-white p-4">
      <div className="flex items-center gap-2 text-[#C9894B]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide text-[#9A8F87]">
          {label}
        </span>
      </div>
      <p className="mt-3 break-words font-semibold leading-6 text-[#1F1B18]">
        {value}
      </p>
    </div>
  );
}
