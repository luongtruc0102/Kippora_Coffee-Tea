"use client";

import {
  Banknote,
  CalendarDays,
  ChefHat,
  CircleX,
  Clock3,
  Eye,
  PackageCheck,
  PhoneCall,
  RefreshCw,
  Search,
  Store,
  Truck,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import OrderDetailModal from "@/components/admin/order-detail-modal";
import OrderReceiptDownloadButton from "@/components/staff/order-receipt-download-button";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  cancelManagedOrder,
  getAdminOrders,
  updateOrderStatus,
  type CancelManagedOrderInput,
} from "@/services/order.service";
import type { Order, OrderStatus } from "@/types/order";

type StaffFilter =
  | "PROCESSING"
  | "PENDING"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DELIVERING"
  | "HISTORY";

const primaryFilters: Array<{
  value: StaffFilter;
  label: string;
}> = [
  {
    value: "PROCESSING",
    label: "Đang xử lý",
  },
  {
    value: "PENDING",
    label: "Chờ xác nhận",
  },
  {
    value: "PREPARING",
    label: "Đang pha chế",
  },
  {
    value: "READY_FOR_PICKUP",
    label: "Chờ khách nhận",
  },
  {
    value: "DELIVERING",
    label: "Đang giao",
  },
  {
    value: "HISTORY",
    label: "Lịch sử",
  },
];

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang pha chế",
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

function formatRecipeQuantity(
  value: number | string,
  unit: "GRAM" | "MILLILITER" | "PIECE",
) {
  const suffix = unit === "GRAM" ? "g" : unit === "MILLILITER" ? "ml" : "cái";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value))} ${suffix}`;
}

// Chuẩn hóa ngày theo múi giờ trên máy nhân viên để tách thống kê từng ngày.
function getLocalDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatHistoryDay(dayKey: string) {
  const label = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${dayKey}T00:00:00`));

  return label.charAt(0).toUpperCase() + label.slice(1);
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

function getNextAction(order: Order): {
  status: OrderStatus;
  label: string;
} | null {
  switch (order.status) {
    case "PENDING":
      return {
        status: "CONFIRMED",
        label: "Xác nhận đơn",
      };

    case "CONFIRMED":
      return {
        status: "PREPARING",
        label: "Bắt đầu pha chế",
      };

    case "PREPARING":
      return order.fulfillmentMethod === "PICKUP"
        ? {
            status: "READY_FOR_PICKUP",
            label: "Pha chế xong",
          }
        : {
            status: "DELIVERING",
            label: "Bàn giao giao hàng",
          };

    case "READY_FOR_PICKUP":
      return {
        status: "COMPLETED",
        label: "Khách đã nhận món",
      };

    case "DELIVERING":
      return {
        status: "COMPLETED",
        label: "Hoàn tất đơn",
      };

    default:
      return null;
  }
}

function playNewOrderSound() {
  try {
    const audioContext = new AudioContext();

    const oscillator = audioContext.createOscillator();

    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);

    gain.gain.exponentialRampToValueAtTime(
      0.16,
      audioContext.currentTime + 0.02,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + 0.35,
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.36);

    oscillator.addEventListener("ended", () => {
      void audioContext.close();
    });
  } catch {
    // Trình duyệt có thể chặn âm thanh khi chưa có tương tác.
  }
}

export default function StaffOrdersPage() {
  const router = useRouter();
  const { showToast } = useAppToast();

  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState<StaffFilter>("PROCESSING");

  const [dateFilter, setDateFilter] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const [todayKey, setTodayKey] = useState(() => getLocalDayKey(new Date()));

  const [soundEnabled, setSoundEnabled] = useState(false);

  const soundEnabledRef = useRef(false);

  const knownOrderIdsRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const enabled = localStorage.getItem("staffOrderSoundEnabled") === "true";

      setSoundEnabled(enabled);
      soundEnabledRef.current = enabled;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Tự đổi sang thống kê ngày mới nếu màn hình staff được mở xuyên qua nửa đêm.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTodayKey(getLocalDayKey(new Date()));
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    async function loadOrders(initialLoad = false) {
      if (
        requestInFlight ||
        (!initialLoad && document.visibilityState !== "visible")
      ) {
        return;
      }

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        router.replace("/login?redirect=/staff/orders");
        return;
      }

      requestInFlight = true;

      if (!initialLoad) {
        setRefreshing(true);
      }

      try {
        const data = await getAdminOrders(accessToken);

        if (!active) return;

        const knownIds = knownOrderIdsRef.current;

        if (knownIds) {
          const newOrders = data.filter(
            (order) => !knownIds.has(order.id) && order.status === "PENDING",
          );

          if (newOrders.length > 0) {
            showToast(
              newOrders.length === 1
                ? `Có đơn hàng mới #${newOrders[0].id}`
                : `Có ${newOrders.length} đơn hàng mới`,
              "info",
            );

            if (soundEnabledRef.current) {
              playNewOrderSound();
            }
          }
        }

        knownOrderIdsRef.current = new Set(data.map((order) => order.id));

        setOrders(data);

        setSelectedOrder((current) =>
          current
            ? (data.find((order) => order.id === current.id) ?? null)
            : null,
        );
      } catch (error) {
        if (initialLoad) {
          showToast(
            error instanceof Error ? error.message : "Không thể tải đơn hàng",
            "error",
          );
        }
      } finally {
        requestInFlight = false;

        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadOrders(true);

    const intervalId = window.setInterval(() => void loadOrders(), 10000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadOrders();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    const refreshEvent = () => {
      void loadOrders();
    };

    window.addEventListener("staff-orders-refresh", refreshEvent);

    return () => {
      active = false;

      window.clearInterval(intervalId);

      document.removeEventListener("visibilitychange", handleVisibility);

      window.removeEventListener("staff-orders-refresh", refreshEvent);
    };
  }, [router, showToast]);

  async function handleUpdateStatus(order: Order, status: OrderStatus) {
    const accessToken = sessionStorage.getItem("accessToken");

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    try {
      setUpdatingOrderId(order.id);

      const updated = await updateOrderStatus(accessToken, order.id, status);

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                ...updated,
              }
            : item,
        ),
      );

      setSelectedOrder((current) =>
        current?.id === order.id
          ? {
              ...current,
              ...updated,
            }
          : current,
      );

      showToast(`Đơn #${order.id}: ${statusLabels[status]}`, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể cập nhật đơn hàng",
        "error",
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleCancelOrder(
    order: Order,
    input: CancelManagedOrderInput,
  ) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      router.replace("/login");
      throw new Error("Không tìm thấy phiên đăng nhập.");
    }
    try {
      setUpdatingOrderId(order.id);
      const updated = await cancelManagedOrder(accessToken, order.id, input);
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, ...updated } : item,
        ),
      );
      setSelectedOrder((current) =>
        current?.id === order.id ? { ...current, ...updated } : current,
      );
      showToast(
        updated.refund
          ? `Đã hoàn ${Number(updated.refund.amount).toLocaleString("vi-VN")} đ và hủy đơn #${order.id}`
          : `Đã hủy đơn #${order.id}`,
        "success",
      );
    } catch (cancelError) {
      const error =
        cancelError instanceof Error
          ? cancelError
          : new Error("Không thể hủy đơn hàng");
      showToast(error.message, "error");
      throw error;
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function toggleSound() {
    const nextValue = !soundEnabled;

    setSoundEnabled(nextValue);
    soundEnabledRef.current = nextValue;

    localStorage.setItem("staffOrderSoundEnabled", String(nextValue));

    if (nextValue) {
      playNewOrderSound();

      showToast("Đã bật âm thanh báo đơn mới", "success");
    } else {
      showToast("Đã tắt âm thanh báo đơn mới", "info");
    }
  }

  function refreshOrders() {
    window.dispatchEvent(new Event("staff-orders-refresh"));
  }

  const visibleOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders
      .filter((order) => {
        const matchesFilter =
          filter === "HISTORY"
            ? ["COMPLETED", "CANCELLED"].includes(order.status)
            : filter === "PROCESSING"
              ? [
                  "PENDING",
                  "CONFIRMED",
                  "PREPARING",
                  "READY_FOR_PICKUP",
                  "DELIVERING",
                ].includes(order.status)
              : order.status === filter;

        if (!matchesFilter) {
          return false;
        }

        if (dateFilter && getLocalDayKey(order.createdAt) !== dateFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [String(order.id), order.receiverName, order.receiverPhone].some(
          (value) => value.toLowerCase().includes(normalizedSearch),
        );
      })
      .sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime();

        const rightTime = new Date(right.createdAt).getTime();

        const activeFilter =
          filter === "PROCESSING" ||
          [
            "PENDING",
            "CONFIRMED",
            "PREPARING",
            "READY_FOR_PICKUP",
            "DELIVERING",
          ].includes(filter);

        return activeFilter ? leftTime - rightTime : rightTime - leftTime;
      });
  }, [dateFilter, filter, orders, search]);

  const summaryDayKey = dateFilter || todayKey;

  const summaryOrders = useMemo(
    () =>
      orders.filter(
        (order) => getLocalDayKey(order.createdAt) === summaryDayKey,
      ),
    [orders, summaryDayKey],
  );

  const pendingCount = summaryOrders.filter(
    (order) => order.status === "PENDING",
  ).length;

  const completedCount = summaryOrders.filter(
    (order) => order.status === "COMPLETED",
  ).length;

  const cancelledCount = summaryOrders.filter(
    (order) => order.status === "CANCELLED",
  ).length;

  // Doanh thu chỉ ghi nhận các đơn hoàn tất trong ngày đang được xem.
  const summaryRevenue = summaryOrders.reduce(
    (total, order) =>
      order.status === "COMPLETED" ? total + Number(order.totalPrice) : total,
    0,
  );

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C9894B]">
            Khu vực nhân viên
          </p>

          <h1 className="mt-2 text-3xl font-bold text-[#2A211D]">
            Xử lý đơn hàng
          </h1>

          <p className="mt-2 text-sm text-[#78866B]">
            Đơn cũ nhất được ưu tiên hiển thị trước.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleSound}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E9E1D8] bg-white px-4 py-2.5 text-sm font-semibold text-[#5E5650]"
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}

            {soundEnabled ? "Âm thanh đang bật" : "Bật âm thanh"}
          </button>

          <button
            type="button"
            disabled={refreshing}
            onClick={refreshOrders}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <Clock3 size={18} />
            <span className="text-sm">Chờ xác nhận</span>
          </div>

          <p className="mt-2 text-2xl font-bold">{pendingCount}</p>
        </div>

        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <PackageCheck size={18} />
            <span className="text-sm">Hoàn thành</span>
          </div>

          <p className="mt-2 text-2xl font-bold">{completedCount}</p>
        </div>

        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-red-600">
            <CircleX size={18} />
            <span className="text-sm">Đã huỷ</span>
          </div>

          <p className="mt-2 text-2xl font-bold">{cancelledCount}</p>
        </div>

        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#9F642F]">
            <Banknote size={18} />
            <span className="text-sm">
              {dateFilter && dateFilter !== todayKey
                ? "Doanh thu ngày chọn"
                : "Doanh thu hôm nay"}
            </span>
          </div>

          <p className="mt-2 text-2xl font-bold text-[#4A2C20]">
            {formatCurrency(summaryRevenue)}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã đơn, tên hoặc số điện thoại..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none focus:border-[#C9894B]"
            />
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {primaryFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setFilter(item.value);

                  if (item.value === "HISTORY") {
                    setDateFilter(todayKey);
                  }
                }}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  filter === item.value
                    ? "bg-[#4A2C20] text-white"
                    : "bg-[#F7F2EC] text-[#5E5650]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0E8E0] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="order-date-filter"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#5E5650]"
            >
              <CalendarDays size={17} className="text-[#C2763D]" />
              Lọc toàn trang theo ngày
            </label>

            <input
              id="order-date-filter"
              type="date"
              value={dateFilter}
              max={todayKey}
              onChange={(event) => setDateFilter(event.target.value)}
              className="h-10 rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] px-3 text-sm text-[#2A211D] outline-none focus:border-[#C9894B]"
            />

            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E9E1D8] px-3 text-sm font-semibold text-[#6E625B] transition hover:bg-[#F7F2EC]"
              >
                <X size={16} />
                Xóa lọc
              </button>
            )}
          </div>

          <span className="text-sm text-[#78866B]">
            {dateFilter
              ? `${visibleOrders.length} đơn trong ngày đã chọn`
              : `${visibleOrders.length} đơn phù hợp`}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-[#E9E1D8] bg-white px-6 py-16 text-center text-sm text-[#78866B]">
          Đang tải đơn hàng...
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#D9CABE] bg-white px-6 py-16 text-center">
          <PackageCheck size={42} className="mx-auto text-[#C9BBB0]" />

          <p className="mt-3 text-sm text-[#78866B]">
            {dateFilter
              ? "Không có đơn hàng trong ngày đã chọn."
              : "Không có đơn hàng phù hợp."}
          </p>

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="mt-4 rounded-xl bg-[#F7F2EC] px-4 py-2 text-sm font-semibold text-[#5E5650]"
            >
              Xem toàn bộ lịch sử
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 xl:grid-cols-2">
          {visibleOrders.map((order, index) => {
            const nextAction = getNextAction(order);

            const dayKey = getLocalDayKey(order.createdAt);

            const previousDayKey =
              index > 0
                ? getLocalDayKey(visibleOrders[index - 1].createdAt)
                : null;

            const showHistoryDay =
              filter === "HISTORY" && dayKey !== previousDayKey;

            return (
              <Fragment key={order.id}>
                {showHistoryDay && (
                  <div className="xl:col-span-2">
                    <div className="flex items-center gap-3 py-1">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#C2763D]">
                        <CalendarDays size={18} />
                      </span>

                      <h2 className="text-base font-bold text-[#4A2C20]">
                        {formatHistoryDay(dayKey)}
                      </h2>

                      <span className="h-px flex-1 bg-[#E9E1D8]" />
                    </div>
                  </div>
                )}

                <article className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-[#F0E8E0] bg-[#FCFAF7] px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#2A211D]">
                          Đơn #{order.id}
                        </p>
                        {order.channel === "POS" && (
                          <span className="rounded-full bg-[#F3E9DE] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#9A5C2F]">
                            Tại quầy
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-[#8A817B]">
                        {formatTime(order.createdAt)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClass(
                        order.status,
                      )}`}
                    >
                      {statusLabels[order.status]}
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#2A211D]">
                          {order.receiverName}
                        </p>

                        {order.receiverPhone ? (
                          <a
                            href={`tel:${order.receiverPhone}`}
                            className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[#C2763D]"
                          >
                            <PhoneCall size={15} />
                            {order.receiverPhone}
                          </a>
                        ) : (
                          <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#8A817B]">
                            <PhoneCall size={15} />
                            Không cung cấp SĐT
                          </span>
                        )}
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F2EC] px-3 py-1.5 text-xs text-[#5E5650]">
                        {order.fulfillmentMethod === "PICKUP" ? (
                          <Store size={14} />
                        ) : (
                          <Truck size={14} />
                        )}

                        {order.fulfillmentMethod === "PICKUP"
                          ? "Đến quán lấy"
                          : "Giao hàng"}
                      </span>
                    </div>

                    <div className="mt-4 divide-y divide-[#F0E8E0] rounded-xl border border-[#E9E1D8]">
                      {order.items.map((item) => (
                        <div key={item.id} className="px-4 py-3">
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-[#2A211D]">
                                {item.productName}
                              </p>

                              <p className="mt-1 text-xs text-[#78866B]">
                                Size {item.size}
                                {item.toppings.length > 0
                                  ? ` · ${item.toppings
                                      .map((topping) => topping.toppingName)
                                      .join(", ")}`
                                  : ""}
                              </p>
                            </div>

                            <strong className="shrink-0 text-[#4A2C20]">
                              × {item.quantity}
                            </strong>
                          </div>

                          {item.recipeIngredients?.length ? (
                            <div className="mt-3 rounded-xl bg-[#F8F5F1] p-3">
                              <p className="flex items-center gap-1.5 text-xs font-semibold text-[#A45F2F]">
                                <ChefHat size={14} /> Công thức cho{" "}
                                {item.quantity} món
                              </p>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {item.recipeIngredients.map((recipe) => (
                                  <div
                                    key={recipe.id}
                                    className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs"
                                  >
                                    <span className="min-w-0 text-[#5E5650]">
                                      {recipe.ingredientName}
                                      {recipe.sourceName.startsWith(
                                        "Topping",
                                      ) && (
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
                      ))}
                    </div>

                    {order.note && (
                      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Ghi chú
                        </p>

                        <p className="mt-1 text-sm leading-6 text-[#5E5650]">
                          {order.note}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm text-[#78866B]">
                        Tổng thanh toán
                      </span>

                      <strong className="text-lg text-[#4A2C20]">
                        {formatCurrency(order.totalPrice)}
                      </strong>
                    </div>

                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                      {order.status === "COMPLETED" && (
                        <OrderReceiptDownloadButton order={order} />
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#5E5650]"
                      >
                        <Eye size={16} />
                        Chi tiết
                      </button>

                      {nextAction && (
                        <button
                          type="button"
                          disabled={updatingOrderId !== null}
                          onClick={() =>
                            void handleUpdateStatus(order, nextAction.status)
                          }
                          className="rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                        >
                          {updatingOrderId === order.id
                            ? "Đang cập nhật..."
                            : nextAction.label}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              </Fragment>
            );
          })}
        </div>
      )}

      <OrderDetailModal
        open={selectedOrder !== null}
        order={selectedOrder}
        updating={updatingOrderId !== null}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={handleUpdateStatus}
        onCancelOrder={handleCancelOrder}
      />
    </>
  );
}
