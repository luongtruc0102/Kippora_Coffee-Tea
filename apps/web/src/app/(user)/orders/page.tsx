"use client";

import {
  CalendarDays,
  ChevronRight,
  Clock3,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  Store,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ActionToast, {
  type ActionToastData,
} from "@/components/ui/action-toast";
import { getMyOrders, reorderMyOrder } from "@/services/order.service";
import type { Order, OrderStatus } from "@/types/order";
import { prepareReorderedCheckout } from "@/utils/cart.util";

type StatusFilter = "ALL" | OrderStatus;

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "PREPARING", label: "Đang chuẩn bị" },
  { value: "READY_FOR_PICKUP", label: "Sẵn sàng tại quán" },
  { value: "DELIVERING", label: "Đang giao" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
];

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

function getStatusLabel(status: OrderStatus) {
  return (
    statusFilters.find((filter) => filter.value === status)?.label ?? status
  );
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

function getPaymentLabel(order: Order) {
  if (order.payment?.method === "BANK_TRANSFER") {
    return "Chuyển khoản";
  }

  return order.fulfillmentMethod === "PICKUP"
    ? "Tiền mặt tại quán"
    : "Tiền mặt khi nhận";
}

export default function MyOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionToast, setActionToast] = useState<ActionToastData | null>(null);
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let requestInFlight = false;

    // Polling cập nhật nền, không bật lại loading hay xóa danh sách đang hiển thị.
    async function loadOrders(initialLoad = false) {
      if (
        requestInFlight ||
        (!initialLoad && document.visibilityState !== "visible")
      ) {
        return;
      }

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        router.replace("/login?redirect=/orders");
        return;
      }

      requestInFlight = true;
      try {
        const data = await getMyOrders(accessToken);

        if (!cancelled) {
          setOrders(data);
          if (initialLoad) {
            setError("");
          }
        }
      } catch (error) {
        // Lỗi polling tạm thời không che danh sách mà khách đang xem.
        if (initialLoad && !cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Không thể tải lịch sử đơn hàng";
          setError(message);
          setActionToast({
            id: ++toastIdRef.current,
            message,
            variant: "error",
          });
        }
      } finally {
        requestInFlight = false;
        if (initialLoad && !cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrders(true);
    const intervalId = window.setInterval(() => void loadOrders(), 15000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadOrders();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  // Chuẩn bị preview từ đơn cũ rồi chuyển thẳng sang checkout, không ghi giỏ hàng.
  async function handleReorder(orderId: number) {
    try {
      setReorderingId(orderId);
      setActionToast(null);

      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) {
        router.replace("/login?redirect=/orders");
        return;
      }

      const result = await reorderMyOrder(accessToken, orderId);
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

      router.push(`/checkout?reorderOrderId=${orderId}`);
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
      setReorderingId(null);
    }
  }

  const filteredOrders = useMemo(() => {
    if (selectedStatus === "ALL") {
      return orders;
    }

    return orders.filter((order) => order.status === selectedStatus);
  }, [orders, selectedStatus]);

  const processingCount = orders.filter((order) =>
    ["PENDING", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "DELIVERING"].includes(order.status),
  ).length;
  const completedCount = orders.filter(
    (order) => order.status === "COMPLETED",
  ).length;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      {actionToast && (
        <ActionToast
          key={actionToast.id}
          toast={actionToast}
          onClose={() => setActionToast(null)}
        />
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9894B]">
            Tài khoản
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#2A211D]">
            Đơn hàng của tôi
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            Theo dõi trạng thái và xem lại toàn bộ đơn đã đặt.
          </p>
        </div>
      </div>

      {!loading && !error && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#8A817B]">
              <ReceiptText size={18} />
              <span className="text-sm">Tổng đơn</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#2A211D]">
              {orders.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#8A817B]">
              <Clock3 size={18} />
              <span className="text-sm">Đang xử lý</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#C9894B]">
              {processingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#8A817B]">
              <PackageCheck size={18} />
              <span className="text-sm">Hoàn tất</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {completedCount}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {statusFilters.map((filter) => {
            const active = selectedStatus === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSelectedStatus(filter.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[#4A2C20] text-white shadow-sm"
                    : "border border-[#E9E1D8] bg-white text-[#5E5650] hover:border-[#D9B38C]"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-[#E9E1D8] bg-white px-5 py-14 text-center text-sm text-[#78866B] shadow-sm">
          Đang tải lịch sử đơn hàng...
        </div>
      ) : filteredOrders.length === 0 && !error ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[#DCCFC3] bg-white px-6 py-14 text-center shadow-sm">
          <PackageSearch className="mx-auto text-[#C9894B]" size={44} />
          <h2 className="mt-4 text-lg font-bold text-[#2A211D]">
            Chưa có đơn hàng phù hợp
          </h2>
          <p className="mt-2 text-sm text-[#78866B]">
            Chọn một trạng thái khác hoặc khám phá menu để đặt món nhé.
          </p>
          <Link
            href="/menu"
            className="mt-5 inline-flex rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white"
          >
            Xem menu
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filteredOrders.map((order) => {
            const itemCount = order.items.reduce(
              (total, item) => total + item.quantity,
              0,
            );
            const isPickup = order.fulfillmentMethod === "PICKUP";

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm transition hover:border-[#D9B38C] hover:shadow-md"
              >
                <div className="flex flex-col gap-3 border-b border-[#F0E8E0] bg-[#FCFAF7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-[#2A211D]">Đơn #{order.id}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#8A817B]">
                      <CalendarDays size={14} />
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClass(order.status)}`}
                  >
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="space-y-2">
                      {order.items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="truncate text-[#5E5650]">
                            {item.productName} · Size {item.size} ×{" "}
                            {item.quantity}
                          </span>
                          <span className="shrink-0 font-semibold text-[#4A2C20]">
                            {formatCurrency(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-xs text-[#8A817B]">
                          Và {order.items.length - 2} món khác
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#6B625C]">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F2EC] px-3 py-1.5">
                        {isPickup ? <Store size={14} /> : <Truck size={14} />}
                        {isPickup ? "Đến quán lấy" : "Giao hàng"}
                      </span>
                      <span className="rounded-full bg-[#F7F2EC] px-3 py-1.5">
                        {getPaymentLabel(order)}
                      </span>
                      <span className="rounded-full bg-[#F7F2EC] px-3 py-1.5">
                        {itemCount} sản phẩm
                      </span>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-5 border-t border-[#F0E8E0] pt-4 md:block md:min-w-44 md:border-l md:border-t-0 md:pl-5 md:pt-0 md:text-right">
                    <div>
                      <p className="text-xs text-[#8A817B]">Tổng thanh toán</p>
                      <p className="mt-1 text-lg font-bold text-[#4A2C20]">
                        {formatCurrency(order.totalPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 md:mt-4 md:justify-end">
                      <button
                        type="button"
                        disabled={reorderingId !== null}
                        onClick={() => void handleReorder(order.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#4A2C20] px-3 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                      >
                        <ShoppingCart size={14} />
                        {reorderingId === order.id
                          ? "Đang chuẩn bị..."
                          : "Mua lại"}
                      </button>
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[#C2763D] hover:text-[#9A5D2E]"
                      >
                        Xem chi tiết
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
