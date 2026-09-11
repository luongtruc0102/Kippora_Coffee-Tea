"use client";

import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Landmark,
  MapPin,
  PackageCheck,
  Phone,
  ShoppingCart,
  UserRound,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ActionToast, {
  type ActionToastData,
} from "@/components/ui/action-toast";
import {
  cancelMyOrder,
  getMyOrderById,
  reorderMyOrder,
} from "@/services/order.service";
import type { Order, OrderStatus } from "@/types/order";
import { prepareReorderedCheckout } from "@/utils/cart.util";
import OrderReviewSection from "@/components/user/order-review-section";

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function getStatusLabel(status: OrderStatus) {
  switch (status) {
    case "PENDING":
      return "Chờ xác nhận";
    case "CONFIRMED":
      return "Đã xác nhận";
    case "PREPARING":
      return "Đang chuẩn bị";
    case "READY_FOR_PICKUP":
      return "Sẵn sàng tại quán";
    case "DELIVERING":
      return "Đang giao";
    case "COMPLETED":
      return "Hoàn tất";
    case "CANCELLED":
      return "Đã hủy";
  }
}

function getStatusClass(status: OrderStatus) {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-700";
    case "CONFIRMED":
      return "bg-blue-50 text-blue-700";
    case "PREPARING":
      return "bg-orange-50 text-orange-700";
    case "READY_FOR_PICKUP":
      return "bg-teal-50 text-teal-700";
    case "DELIVERING":
      return "bg-violet-50 text-violet-700";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700";
    case "CANCELLED":
      return "bg-red-50 text-red-600";
  }
}

export default function UserOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionToast, setActionToast] = useState<ActionToastData | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reordering, setReordering] = useState(false);
  const lastStatusRef = useRef<OrderStatus | null>(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let requestInFlight = false;

    // Lần đầu hiển thị loading; các lần polling cập nhật ngầm để UI không nhấp nháy.
    async function loadOrder(initialLoad = false) {
      if (
        !initialLoad &&
        (lastStatusRef.current === "COMPLETED" ||
          lastStatusRef.current === "CANCELLED")
      ) {
        return;
      }

      if (requestInFlight) {
        return;
      }

      requestInFlight = true;
      try {
        const accessToken = sessionStorage.getItem("accessToken");
        if (!accessToken) {
          router.replace(`/login?redirect=/orders/${params.id}`);
          return;
        }

        const orderId = Number(params.id);
        if (!Number.isInteger(orderId) || orderId <= 0) {
          throw new Error("Mã đơn hàng không hợp lệ");
        }

        const nextOrder = await getMyOrderById(accessToken, orderId);
        if (cancelled) {
          return;
        }

        if (
          lastStatusRef.current &&
          lastStatusRef.current !== nextOrder.status
        ) {
          setActionToast({
            id: ++toastIdRef.current,
            message: `Trạng thái đơn hàng đã cập nhật: ${getStatusLabel(
              nextOrder.status,

            )}.`,
            variant: "info",
          });
        }

        lastStatusRef.current = nextOrder.status;
        setOrder(nextOrder);
      } catch (error) {
        // Mất mạng tạm thời khi polling không thay thế dữ liệu đơn đang hiển thị.
        if (initialLoad && !cancelled) {
          setError(
            error instanceof Error ? error.message : "Không thể tải đơn hàng",
          );
        }
      } finally {
        requestInFlight = false;
        if (initialLoad && !cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrder(true);
    const intervalId = window.setInterval(() => void loadOrder(), 10000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadOrder();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [params.id, router]);

  async function handleCancelOrder() {
    if (!order) {
      return;
    }

    try {
      setCancelling(true);
      setActionToast(null);

      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) {
        router.replace(`/login?redirect=/orders/${order.id}`);
        return;
      }

      const reason = cancelReason.trim();
      if (reason.length < 3) {
        throw new Error("Vui lòng nhập lý do hủy ít nhất 3 ký tự");
      }

      const cancelledOrder = await cancelMyOrder(accessToken, order.id, reason);
      lastStatusRef.current = cancelledOrder.status;
      setOrder(cancelledOrder);
      setCancelConfirmOpen(false);
      setCancelReason("");
      setActionToast({
        id: ++toastIdRef.current,
        message:
          "Đã hủy đơn hàng. Điểm tích lũy và lượt voucher đã được hoàn lại.",
        variant: "success",
      });
    } catch (error) {
      setActionToast({
        id: ++toastIdRef.current,
        message:
          error instanceof Error ? error.message : "Không thể hủy đơn hàng",
        variant: "error",
      });
    } finally {
      setCancelling(false);
    }
  }

  // Chuẩn bị preview từ đơn cũ rồi chuyển thẳng sang checkout, không ghi giỏ hàng.
  async function handleReorderOrder() {
    if (!order) {
      return;
    }

    try {
      setReordering(true);
      setActionToast(null);

      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) {
        router.replace(`/login?redirect=/orders/${order.id}`);
        return;
      }

      const result = await reorderMyOrder(accessToken, order.id);
      const checkoutMessage = prepareReorderedCheckout(result);

      if (!checkoutMessage) {
        const skippedDetail = result.skippedItems
          .map((item) => `${item.productName}: ${item.reason}`)
          .join("; ");
        setActionToast({
          id: ++toastIdRef.current,
          message: skippedDetail
            ? `Không có món nào được thêm. ${skippedDetail}`
            : "Không có món nào trong đơn có thể mua lại.",
          variant: "error",
        });
        return;
      }

      router.push(`/checkout?reorderOrderId=${order.id}`);
    } catch (error) {
      setActionToast({
        id: ++toastIdRef.current,
        message:
          error instanceof Error
            ? error.message
            : "Không thể chuẩn bị đơn hàng mua lại",
        variant: "error",
      });
    } finally {
      setReordering(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-[#78866B]">
        Đang tải đơn hàng...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-red-600">
        {error || "Không tìm thấy đơn hàng"}
      </div>
    );
  }

  const isCod = order.payment?.method === "COD";
  const isPickup = order.fulfillmentMethod === "PICKUP";
  const statusSteps: OrderStatus[] = isPickup
    ? ["PENDING", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"]
    : ["PENDING", "CONFIRMED", "PREPARING", "DELIVERING", "COMPLETED"];
  const currentStepIndex = statusSteps.indexOf(order.status);
  const voucherCodes =
    order.appliedVouchers?.map((voucher) => voucher.code).join(", ") ||
    order.voucherCode ||
    "";
  const paymentStatusLabel =
    order.payment?.status === "PAID"
      ? "Đã thanh toán"
      : order.payment?.status === "FAILED"
        ? "Thanh toán thất bại"
        : order.payment?.status === "CANCELLED"
          ? "Đã hủy thanh toán"
          : "Chờ thanh toán";
  const deliveryBaseFee = Number(order.deliveryBaseFee);
  const deliveryDiscount = Number(order.deliveryDiscountAmount);
  const voucherDiscount = Number(order.discountAmount);
  const loyaltyDiscount = Number(order.loyaltyDiscountAmount);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      {actionToast && (
        <ActionToast
          key={actionToast.id}
          toast={actionToast}
          onClose={() => setActionToast(null)}
        />
      )}
      <section className="rounded-3xl border border-[#E9E1D8] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6B625C] transition hover:text-[#4A2C20]"
          >
            <ArrowLeft size={17} />
            Đơn hàng của tôi
          </Link>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClass(order.status)}`}
          >
            {getStatusLabel(order.status)}
          </span>
        </div>

        <div className="mt-6 text-center">
          {order.status === "CANCELLED" ? (
            <XCircle className="mx-auto text-red-500" size={48} />
          ) : (
            <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
          )}
          <h1 className="mt-4 text-2xl font-bold text-[#2A211D]">
            Chi tiết đơn hàng #{order.id}
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            {order.status === "CANCELLED"
              ? "Đơn hàng này đã được hủy."
              : "Cửa hàng đang cập nhật tiến độ đơn hàng của bạn."}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-[#2A211D]">Tiến độ đơn hàng</h2>
          {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
            <span className="inline-flex items-center gap-2 text-xs font-medium text-[#78866B]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Tự động cập nhật
            </span>
          )}
        </div>
        {order.status === "CANCELLED" ? (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            Đơn đã hủy và sẽ không tiếp tục xử lý.
            {order.cancelReason && (
              <p className="mt-1 font-medium">Lý do: {order.cancelReason}</p>
            )}
            {order.cancelledAt && (
              <p className="mt-1 text-xs text-red-500">
                Hủy lúc {new Date(order.cancelledAt).toLocaleString("vi-VN")}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto pb-2">
            <div className="relative min-w-[560px] px-3 sm:min-w-0 sm:px-5">
              <div
                className="absolute top-6 z-0 grid h-1.5 overflow-hidden rounded-full"
                style={{
                  left: `${50 / statusSteps.length}%`,
                  right: `${50 / statusSteps.length}%`,
                  gridTemplateColumns: `repeat(${statusSteps.length - 1}, minmax(0, 1fr))`,
                }}
                aria-hidden="true"
              >
                {statusSteps.slice(0, -1).map((step, index) => {
                  const completedSegment = index < currentStepIndex;
                  const activeSegment =
                    index === currentStepIndex && order.status !== "COMPLETED";

                  return (
                    <span
                      key={`${order.status}-${step}`}
                      className="relative h-full overflow-hidden bg-[#E9E1D8]"
                    >
                      {(completedSegment || activeSegment) && (
                        <span
                          className={`absolute inset-y-0 left-0 bg-gradient-to-r from-[#B86F35] to-[#C9894B] ${
                            activeSegment
                              ? "order-progress-segment-fill"
                              : "w-full"
                          }`}
                        />
                      )}
                    </span>
                  );
                })}
              </div>

              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `repeat(${statusSteps.length}, minmax(0, 1fr))`,
                }}
              >
                {statusSteps.map((step, index) => {
                  const reached = index <= currentStepIndex;
                  const current = index === currentStepIndex;

                  return (
                    <div
                      key={step}
                      className="flex min-w-0 flex-col items-center px-1 text-center"
                      aria-current={current ? "step" : undefined}
                    >
                      <span
                        className={`relative z-20 flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition duration-500 ${
                          current ? "bg-[#F6DFC8]" : "bg-white"
                        }`}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-1 shadow-sm">
                          <span
                            className={`flex h-full w-full items-center justify-center rounded-full text-sm font-bold transition-colors duration-500 ${
                              reached
                                ? "bg-[#C9894B] text-white"
                                : "bg-[#E9E1D8] text-[#8A817B]"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </span>
                      </span>
                      <span
                        className={`mt-3 text-xs font-semibold leading-4 sm:text-sm ${
                          reached ? "text-[#9A5D2E]" : "text-[#A0968F]"
                        }`}
                      >
                        {getStatusLabel(step)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <PackageCheck size={19} className="text-[#C9894B]" />
            <h2 className="font-bold text-[#2A211D]">Sản phẩm</h2>
          </div>
          <div className="mt-4 divide-y divide-[#F0E8E0]">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between gap-3 py-3 text-sm"
              >
                <span className="text-[#5E5650]">
                  {item.productName} · {item.size} × {item.quantity}
                </span>
                <strong className="shrink-0 text-[#4A2C20]">
                  {formatCurrency(item.lineTotal)}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            {isCod ? (
              <Banknote size={19} className="text-[#C9894B]" />
            ) : (
              <Landmark size={19} className="text-[#C9894B]" />
            )}
            <h2 className="font-bold text-[#2A211D]">Thanh toán</h2>
          </div>
          <p className="mt-4 text-sm font-semibold text-[#4A2C20]">
            {isCod
              ? isPickup
                ? "Thanh toán tiền mặt tại quán"
                : "Thanh toán tiền mặt khi nhận hàng"
              : "Chuyển khoản ngân hàng"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#78866B]">
            {isCod
              ? isPickup
                ? "Anh/chị vui lòng chuẩn bị đúng số tiền khi đến nhận món tại quán."
                : "Anh/chị vui lòng chuẩn bị đúng số tiền khi đơn được giao tới."
              : "Đơn đang chờ xác nhận chuyển khoản. Thông tin tài khoản sẽ được cửa hàng cung cấp khi cấu hình ngân hàng."}
          </p>
        </section>
        <p className="mt-3 text-xs font-semibold text-[#8A817B]">
          Trạng thái: {paymentStatusLabel}
        </p>
      </div>

      <section className="mt-6 rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          {isPickup ? (
            <Store size={19} className="text-[#C9894B]" />
          ) : (
            <MapPin size={19} className="text-[#C9894B]" />
          )}
          <h2 className="font-bold text-[#2A211D]">
            {isPickup ? "Đến quán lấy" : "Giao hàng"}
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#5E5650]">
            <UserRound size={16} className="text-[#C9894B]" />
            {order.receiverName}
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#5E5650]">
            <Phone size={16} className="text-[#C9894B]" />
            {order.receiverPhone}
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-[#FAF8F5] px-3 py-3 text-sm leading-6 text-[#5E5650]">
          {order.deliveryAddress}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#78866B]">
          {isPickup ? (
            <span className="font-semibold text-emerald-700">
              Không tính phí giao hàng
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5">
                <Truck size={16} />{" "}
                {Number(order.deliveryDistanceKm).toLocaleString("vi-VN")} km
              </span>
              <span>Phí giao hàng: {formatCurrency(order.deliveryFee)}</span>
            </>
          )}
        </div>
        {order.note && (
          <div className="mt-4 border-t border-[#F0E8E0] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A817B]">
              Ghi chú
            </p>
            <p className="mt-2 text-sm leading-6 text-[#5E5650]">
              {order.note}
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <PackageCheck size={19} className="text-[#C9894B]" />
          <h2 className="font-bold text-[#2A211D]">Chi tiết thanh toán</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="mt-4 flex justify-between">
            <span className="text-[#78866B]">Tiền món</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {voucherDiscount > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-[#78866B]">
                Voucher{voucherCodes ? ` (${voucherCodes})` : ""}
              </span>
              <span className="shrink-0 text-emerald-700">
                -{formatCurrency(voucherDiscount)}
              </span>
            </div>
          )}
          {loyaltyDiscount > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-[#78866B]">
                Điểm tích lũy ({order.loyaltyPointsUsed.toLocaleString("vi-VN")}{" "}
                điểm)
              </span>
              <span className="shrink-0 text-emerald-700">
                -{formatCurrency(loyaltyDiscount)}
              </span>
            </div>
          )}
          {isPickup ? (
            <div className="flex justify-between">
              <span className="text-[#78866B]">Phí nhận tại quán</span>
              <span className="font-medium text-emerald-700">Miễn phí</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-[#78866B]">Phí giao hàng gốc</span>
                <span>{formatCurrency(deliveryBaseFee)}</span>
              </div>
              {deliveryDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#78866B]">Ưu đãi giao hàng</span>
                  <span className="text-emerald-700">
                    -{formatCurrency(deliveryDiscount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-medium text-[#2A211D]">
                <span>Phí giao hàng sau ưu đãi</span>
                <span>{formatCurrency(order.deliveryFee)}</span>
              </div>
            </>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[#E9E1D8] pt-4">
          <span className="font-semibold text-[#2A211D]">Tổng thanh toán</span>
          <span className="text-xl font-bold text-[#4A2C20]">
            {formatCurrency(order.totalPrice)}
          </span>
        </div>
      </section>

      {order.status ===
        "COMPLETED" && (
        <OrderReviewSection
          orderId={order.id}
          items={order.items}
        />
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {order.status === "PENDING" && (
          <button
            type="button"
            onClick={() => setCancelConfirmOpen(true)}
            className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            Hủy đơn hàng
          </button>
        )}
        <Link
          href="/orders"
          className="rounded-xl border border-[#D9CABE] bg-white px-5 py-3 text-sm font-semibold text-[#4A2C20]"
        >
          Xem tất cả đơn hàng
        </Link>
        <button
          type="button"
          disabled={reordering}
          onClick={() => void handleReorderOrder()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        >
          <ShoppingCart size={17} />
          {reordering ? "Đang chuẩn bị..." : "Mua lại đơn này"}
        </button>
      </div>

      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#E9E1D8] bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <XCircle size={24} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-[#2A211D]">
              Hủy đơn hàng #{order.id}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#78866B]">
              Đơn sẽ ngừng xử lý. Điểm tích lũy đã dùng và lượt voucher của đơn
              này sẽ được hoàn lại.
            </p>
            <label className="mt-4 block text-sm font-semibold text-[#4A2C20]">
              Lý do hủy
              <textarea
                value={cancelReason}
                maxLength={300}
                rows={3}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ví dụ: Tôi muốn thay đổi món trong đơn..."
                className="mt-2 w-full resize-none rounded-xl border border-[#D9CABE] px-3 py-2.5 text-sm font-normal outline-none transition focus:border-[#C9894B]"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => {
                  setCancelConfirmOpen(false);
                  setCancelReason("");
                }}
                className="rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#5E5650] disabled:opacity-60"
              >
                Giữ đơn
              </button>
              <button
                type="button"
                disabled={cancelling || cancelReason.trim().length < 3}
                onClick={() => void handleCancelOrder()}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {cancelling ? "Đang hủy..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
