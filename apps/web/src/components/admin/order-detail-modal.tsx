"use client";

import {
  Check,
  ChefHat,
  ChevronRight,
  CircleX,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  User,
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";

import type { Order, OrderStatus, RefundMethod } from "@/types/order";
import type { CancelManagedOrderInput } from "@/services/order.service";

type Props = {
  open: boolean;
  order: Order | null;
  updating: boolean;

  onClose: () => void;

  onUpdateStatus: (order: Order, status: OrderStatus) => Promise<void>;
  onCancelOrder: (
    order: Order,
    input: CancelManagedOrderInput,
  ) => Promise<void>;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang chuẩn bị",
  READY_FOR_PICKUP: "Sẵn sàng nhận",
  DELIVERING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRecipeQuantity(
  value: number | string,
  unit: "GRAM" | "MILLILITER" | "PIECE",
) {
  const suffix = unit === "GRAM" ? "g" : unit === "MILLILITER" ? "ml" : "cái";

  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 3,
  }).format(Number(value))} ${suffix}`;
}

function getNextStatuses(
  status: OrderStatus,
  fulfillmentMethod: Order["fulfillmentMethod"],
): OrderStatus[] {
  switch (status) {
    case "PENDING":
      return ["CONFIRMED", "CANCELLED"];

    case "CONFIRMED":
      return ["PREPARING", "CANCELLED"];

    case "PREPARING":
      return fulfillmentMethod === "PICKUP" ? ["COMPLETED"] : ["DELIVERING"];

    case "READY_FOR_PICKUP":
      return ["COMPLETED"];

    case "DELIVERING":
      return ["COMPLETED"];

    default:
      return [];
  }
}

export default function OrderDetailModal({
  open,
  order,
  updating,
  onClose,
  onUpdateStatus,
  onCancelOrder,
}: Props) {
  const [cancelFormOpen, setCancelFormOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [cancelError, setCancelError] = useState("");

  function openCancellationForm() {
    if (!order) return;
    setCancelReason("");
    setRefundMethod(
      order.payment?.method === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH",
    );
    setCancelError("");
    setCancelFormOpen(true);
  }

  if (!open || !order) {
    return null;
  }

  const nextStatuses = getNextStatuses(order.status, order.fulfillmentMethod);

  const paymentMethod =
    order.payment?.method === "BANK_TRANSFER"
      ? "Chuyển khoản"
      : order.payment?.method === "COD"
        ? "Thanh toán khi nhận hàng"
        : "Chưa có";

  const paymentStatus = !order.payment
    ? "Chưa thanh toán"
    : order.payment.status === "PAID"
      ? "Đã thanh toán"
      : order.payment.status === "PENDING"
        ? "Chờ thanh toán"
        : order.payment.status === "FAILED"
          ? "Thất bại"
          : order.payment.status === "REFUNDED"
            ? "Đã hoàn tiền"
            : "Đã hủy";

  const hasPaidPayment = order.payment?.status === "PAID";
  const canCancel =
    order.status !== "CANCELLED" &&
    (hasPaidPayment || ["PENDING", "CONFIRMED"].includes(order.status));

  async function submitCancellation(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setCancelError("Vui lòng nhập lý do hủy có ít nhất 3 ký tự.");
      return;
    }
    setCancelError("");
    try {
      await onCancelOrder(order, {
        reason,
        refundMethod: hasPaidPayment ? refundMethod : undefined,
      });
      setCancelFormOpen(false);
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : "Không thể hủy đơn hàng.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#E9E1D8] bg-white shadow-xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E9E1D8] bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-[#1F1B18]">
                Đơn hàng #{order.id}
              </h3>

              <span className="rounded-full bg-[#F7F2EC] px-3 py-1 text-xs font-semibold text-[#4A2C20]">
                {STATUS_LABELS[order.status]}
              </span>
            </div>

            <p className="mt-1 text-sm text-[#78866B]">
              {formatDate(order.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#78866B] transition hover:bg-[#FAF8F5]"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E9E1D8] bg-[#FAF8F5] p-5">
              <h4 className="font-semibold text-[#1F1B18]">
                {order.fulfillmentMethod === "PICKUP"
                  ? "Thông tin nhận tại quán"
                  : "Thông tin giao hàng"}
              </h4>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <User size={17} className="mt-0.5 text-[#C9894B]" />

                  <div>
                    <p className="text-xs text-[#8A817B]">Người nhận</p>

                    <p className="font-medium text-[#1F1B18]">
                      {order.receiverName}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone size={17} className="mt-0.5 text-[#C9894B]" />

                  <div>
                    <p className="text-xs text-[#8A817B]">Số điện thoại</p>

                    <p className="font-medium text-[#1F1B18]">
                      {order.receiverPhone}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin size={17} className="mt-0.5 text-[#C9894B]" />

                  <div>
                    <p className="text-xs text-[#8A817B]">
                      {order.fulfillmentMethod === "PICKUP"
                        ? "Địa chỉ quán"
                        : "Địa chỉ giao hàng"}
                    </p>

                    <p className="font-medium leading-6 text-[#1F1B18]">
                      {order.deliveryAddress}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E9E1D8] p-5">
              <h4 className="font-semibold text-[#1F1B18]">Thanh toán</h4>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#78866B]">Phương thức</span>

                  <span className="text-right font-medium text-[#1F1B18]">
                    {paymentMethod}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-[#78866B]">Trạng thái</span>

                  <span className="font-medium text-[#1F1B18]">
                    {paymentStatus}
                  </span>
                </div>

                {order.payment?.transactionCode && (
                  <div className="flex justify-between gap-4">
                    <span className="text-[#78866B]">Mã giao dịch</span>

                    <span className="font-medium text-[#1F1B18]">
                      {order.payment.transactionCode}
                    </span>
                  </div>
                )}

                {order.refund && (
                  <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-violet-700">
                        Đã hoàn tiền
                      </span>
                      <strong className="text-violet-800">
                        {formatCurrency(order.refund.amount)}
                      </strong>
                    </div>
                    <p className="mt-1 text-xs text-violet-700/80">
                      {order.refund.code} ·{" "}
                      {order.refund.method === "CASH"
                        ? "Tiền mặt"
                        : "Chuyển khoản"}
                    </p>
                    <p className="mt-2 text-sm text-[#5E5650]">
                      {order.refund.reason}
                    </p>
                  </div>
                )}

                {order.voucherCode && (
                  <div className="flex justify-between gap-4">
                    <span className="text-[#78866B]">Voucher</span>

                    <span className="font-semibold text-[#C9894B]">
                      {order.voucherCode}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E9E1D8]">
            <div className="flex items-center gap-2 border-b border-[#E9E1D8] bg-[#FAF8F5] px-5 py-4">
              <Package size={18} className="text-[#C9894B]" />

              <h4 className="font-semibold text-[#1F1B18]">Sản phẩm</h4>
            </div>

            <div className="divide-y divide-[#F0E8E0]">
              {order.items.map((item) => (
                <div key={item.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1F1B18]">
                        {item.productName}
                      </p>

                      <p className="mt-1 text-sm text-[#78866B]">
                        Size {item.size} · {formatCurrency(item.variantPrice)}
                      </p>

                      {item.toppings.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.toppings.map((topping) => (
                            <span
                              key={topping.id}
                              className="rounded-lg bg-[#F7F2EC] px-2.5 py-1 text-xs text-[#5E5650]"
                            >
                              {topping.toppingName} +{" "}
                              {formatCurrency(topping.toppingPrice)}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.recipeIngredients?.length ? (
                        <div className="mt-3 rounded-xl bg-[#F8F5F1] p-3">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#A45F2F]">
                            <ChefHat size={14} />
                            Công thức cho {item.quantity} món
                          </p>

                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {item.recipeIngredients.map((recipe) => (
                              <div
                                key={recipe.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs"
                              >
                                <span className="min-w-0 text-[#5E5650]">
                                  {recipe.ingredientName}
                                  {recipe.sourceName.startsWith("Topping") && (
                                    <small className="ml-1 text-[#9A8F87]">
                                      ({recipe.sourceName})
                                    </small>
                                  )}
                                </span>

                                <strong className="shrink-0 text-[#4A2C20]">
                                  {formatRecipeQuantity(
                                    recipe.totalQuantity,
                                    recipe.unit,
                                  )}
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                          Món này chưa có công thức nguyên liệu.
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm text-[#78866B]">x{item.quantity}</p>

                      <p className="mt-1 font-semibold text-[#4A2C20]">
                        {formatCurrency(item.lineTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {order.note && (
            <div className="rounded-2xl border border-[#E9E1D8] bg-[#FFFDF9] p-5">
              <p className="text-sm font-semibold text-[#1F1B18]">
                Ghi chú của khách
              </p>

              <p className="mt-2 text-sm leading-6 text-[#5E5650]">
                {order.note}
              </p>
            </div>
          )}

          <div className="ml-auto max-w-md space-y-3 rounded-2xl border border-[#E9E1D8] p-5">
            <div className="flex justify-between text-sm">
              <span className="text-[#78866B]">Tạm tính</span>

              <span className="font-medium text-[#1F1B18]">
                {formatCurrency(order.subtotal)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-[#78866B]">Giảm giá</span>

              <span className="font-medium text-emerald-700">
                - {formatCurrency(order.discountAmount)}
              </span>
            </div>

            {Number(order.loyaltyPointsUsed) > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-[#78866B]">Điểm đã dùng</span>

                  <span className="font-medium text-[#4A2C20]">
                    {Number(order.loyaltyPointsUsed).toLocaleString("vi-VN")}{" "}
                    điểm
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-[#78866B]">Giảm từ điểm</span>

                  <span className="font-medium text-emerald-700">
                    - {formatCurrency(order.loyaltyDiscountAmount)}
                  </span>
                </div>
              </>
            )}

            <div className="border-t border-[#E9E1D8] pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1F1B18]">
                  Tổng thanh toán
                </span>

                <span className="text-xl font-bold text-[#4A2C20]">
                  {formatCurrency(order.totalPrice)}
                </span>
              </div>
            </div>

            {order.status === "COMPLETED" &&
              Number(order.loyaltyPointsEarned) > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-[#F4F8F1] px-3 py-2.5">
                  <span className="text-sm font-medium text-[#5F7254]">
                    Điểm khách nhận
                  </span>

                  <span className="font-bold text-[#5F7254]">
                    +{Number(order.loyaltyPointsEarned).toLocaleString("vi-VN")}{" "}
                    điểm
                  </span>
                </div>
              )}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9E1D8] bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={updating}
            className="rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] transition hover:bg-[#FAF8F5]"
          >
            Đóng
          </button>

          {nextStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((status) => {
                const isCancel = status === "CANCELLED";

                return (
                  <button
                    key={status}
                    type="button"
                    disabled={updating}
                    onClick={() =>
                      isCancel
                        ? openCancellationForm()
                        : onUpdateStatus(order, status)
                    }
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                      isCancel
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-[#4A2C20] text-white hover:bg-[#382118]"
                    }`}
                  >
                    {isCancel ? (
                      <CircleX size={17} />
                    ) : status === "COMPLETED" ? (
                      <Check size={17} />
                    ) : (
                      <ChevronRight size={17} />
                    )}

                    {STATUS_LABELS[status]}
                  </button>
                );
              })}
            </div>
          )}
          {canCancel && !nextStatuses.includes("CANCELLED") && (
            <button
              type="button"
              disabled={updating}
              onClick={openCancellationForm}
              className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
            >
              <RotateCcw size={17} />
              Hủy đơn và hoàn tiền
            </button>
          )}
        </div>
      </div>

      {cancelFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
          <form
            onSubmit={submitCancellation}
            className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-red-500">
                  Đơn hàng #{order.id}
                </p>
                <h3 className="mt-1 text-xl font-bold text-[#2A211D]">
                  {hasPaidPayment ? "Hủy đơn và hoàn tiền" : "Xác nhận hủy đơn"}
                </h3>
              </div>
              <button
                type="button"
                disabled={updating}
                onClick={() => setCancelFormOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#8A817B] hover:bg-[#F7F2EC]"
              >
                <X size={19} />
              </button>
            </header>

            <div className="space-y-4 p-6">
              {hasPaidPayment && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <p className="text-xs font-semibold text-violet-700">
                    Số tiền hoàn toàn bộ
                  </p>
                  <p className="mt-1 text-2xl font-bold text-violet-900">
                    {formatCurrency(order.payment?.amount ?? order.totalPrice)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-violet-700/80">
                    Số tiền lấy từ giao dịch gốc và không thể chỉnh thủ công.
                  </p>
                </div>
              )}

              {hasPaidPayment && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#2A211D]">
                    Phương thức trả lại tiền *
                  </span>
                  <select
                    value={refundMethod}
                    disabled={updating}
                    onChange={(event) =>
                      setRefundMethod(event.target.value as RefundMethod)
                    }
                    className="h-12 w-full rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none focus:border-[#C9894B]"
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                  </select>
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#2A211D]">
                  Lý do hủy *
                </span>
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  rows={4}
                  value={cancelReason}
                  disabled={updating}
                  onChange={(event) => {
                    setCancelReason(event.target.value);
                    setCancelError("");
                  }}
                  placeholder="Ví dụ: khách yêu cầu hủy, pha sai món..."
                  className="w-full resize-none rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
                />
              </label>

              {order.inventoryState === "CONSUMED" && (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
                  Món đã bắt đầu pha nên nguyên liệu đã sử dụng sẽ không được
                  cộng lại vào kho.
                </p>
              )}
              {order.inventoryState === "RESERVED" && (
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                  Nguyên liệu mới đang giữ sẽ được giải phóng về lượng có thể
                  dùng.
                </p>
              )}
              {cancelError && (
                <p className="text-sm font-medium text-red-600">
                  {cancelError}
                </p>
              )}
            </div>

            <footer className="flex justify-end gap-3 border-t border-[#E9E1D8] px-6 py-4">
              <button
                type="button"
                disabled={updating}
                onClick={() => setCancelFormOpen(false)}
                className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold text-[#5E5650]"
              >
                Quay lại
              </button>
              <button
                type="submit"
                disabled={updating || cancelReason.trim().length < 3}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
              >
                {updating
                  ? "Đang xử lý..."
                  : hasPaidPayment
                    ? "Hoàn tiền và hủy đơn"
                    : "Xác nhận hủy đơn"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
