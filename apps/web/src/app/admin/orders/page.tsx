"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ChevronDown, Eye, Search } from "lucide-react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import OrderDetailModal from "@/components/admin/order-detail-modal";
import ToastMessage from "@/components/ui/toast-message";

import {
  cancelManagedOrder,
  getAdminOrders,
  updateOrderStatus,
  type CancelManagedOrderInput,
} from "@/services/order.service";

import type { Order, OrderStatus } from "@/types/order";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("ALL");

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const loadOrders = useCallback(async (query = "", signal?: AbortSignal) => {
    await Promise.resolve();

    try {
      setLoading(true);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const data = await getAdminOrders(accessToken, query, signal);

      setOrders(data);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setError(
        error instanceof Error ? error.message : "Không thể tải đơn hàng",
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      void loadOrders(debouncedSearch, controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [debouncedSearch, loadOrders]);

  async function handleUpdateStatus(order: Order, status: OrderStatus) {
    try {
      setError("");
      setUpdatingOrderId(order.id);

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const updated = await updateOrderStatus(accessToken, order.id, status);

      // Không reload toàn bảng để tránh giật UI
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
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái đơn hàng",
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleCancelOrder(
    order: Order,
    input: CancelManagedOrderInput,
  ) {
    try {
      setError("");
      setUpdatingOrderId(order.id);
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");
      const updated = await cancelManagedOrder(accessToken, order.id, input);
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, ...updated } : item,
        ),
      );
      setSelectedOrder((current) =>
        current?.id === order.id ? { ...current, ...updated } : current,
      );
    } catch (cancelError) {
      const error =
        cancelError instanceof Error
          ? cancelError
          : new Error("Không thể hủy đơn hàng");
      setError(error.message);
      throw error;
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        selectedStatus === "ALL" || order.status === selectedStatus;

      const matchesPayment =
        selectedPaymentStatus === "ALL" ||
        order.payment?.status === selectedPaymentStatus;

      return matchesStatus && matchesPayment;
    });
  }, [orders, selectedStatus, selectedPaymentStatus]);

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

  function getStatusLabel(status: Order["status"]) {
    switch (status) {
      case "PENDING":
        return "Chờ xác nhận";

      case "CONFIRMED":
        return "Đã xác nhận";

      case "PREPARING":
        return "Đang chuẩn bị";

      case "READY_FOR_PICKUP":
        return "Sẵn sàng nhận";

      case "DELIVERING":
        return "Đang giao";

      case "COMPLETED":
        return "Hoàn tất";

      case "CANCELLED":
        return "Đã hủy";
    }
  }

  function getStatusClass(status: Order["status"]) {
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
    if (!order.payment) {
      return "Chưa thanh toán";
    }

    switch (order.payment.status) {
      case "PENDING":
        return "Chờ thanh toán";

      case "PAID":
        return "Đã thanh toán";

      case "FAILED":
        return "Thất bại";

      case "CANCELLED":
        return "Đã hủy";
    }
  }

  function getPaymentClass(order: Order) {
    if (!order.payment) {
      return "bg-[#F3F0ED] text-[#78866B]";
    }

    switch (order.payment.status) {
      case "PENDING":
        return "bg-amber-50 text-amber-700";

      case "PAID":
        return "bg-emerald-50 text-emerald-700";

      case "FAILED":
        return "bg-red-50 text-red-600";

      case "CANCELLED":
        return "bg-[#F3F0ED] text-[#78866B]";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-[#1F1B18]">Quản lý đơn hàng</h2>

        <p className="mt-1 text-[#78866B]">
          Theo dõi và xử lý đơn hàng của khách hàng.
        </p>
      </div>

      <ToastMessage message={error} />

      <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo mã đơn, tên người nhận hoặc SĐT..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none transition focus:border-[#C9894B]"
            />
          </div>

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm outline-none focus:border-[#C9894B]"
            >
              <option value="ALL">Tất cả trạng thái</option>

              <option value="PENDING">Chờ xác nhận</option>

              <option value="CONFIRMED">Đã xác nhận</option>

              <option value="PREPARING">Đang chuẩn bị</option>

              <option value="READY_FOR_PICKUP">Sẵn sàng nhận</option>

              <option value="DELIVERING">Đang giao</option>

              <option value="COMPLETED">Hoàn tất</option>

              <option value="CANCELLED">Đã hủy</option>
            </select>

            <ChevronDown
              size={18}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5E5650]"
            />
          </div>

          <div className="relative">
            <select
              value={selectedPaymentStatus}
              onChange={(event) => setSelectedPaymentStatus(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm outline-none focus:border-[#C9894B]"
            >
              <option value="ALL">Tất cả thanh toán</option>

              <option value="PENDING">Chờ thanh toán</option>

              <option value="PAID">Đã thanh toán</option>

              <option value="FAILED">Thất bại</option>

              <option value="CANCELLED">Đã hủy</option>
            </select>

            <ChevronDown
              size={18}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5E5650]"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[#78866B]">Đang tải đơn hàng...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[20%]" />
                <col className="w-[13%]" />
                <col className="w-[14%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>

              <thead className="bg-[#FAF8F5]">
                <tr className="border-b border-[#E9E1D8] text-left text-xs font-semibold uppercase tracking-wide text-[#78866B]">
                  <th className="px-5 py-4">Mã đơn</th>

                  <th className="px-5 py-4">Khách hàng</th>

                  <th className="px-5 py-4">Tổng tiền</th>

                  <th className="px-5 py-4">Thanh toán</th>

                  <th className="px-5 py-4">Trạng thái</th>

                  <th className="px-5 py-4">Thời gian</th>

                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm text-[#78866B]"
                    >
                      Không tìm thấy đơn hàng.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-[#F0E8E0] transition-colors last:border-b-0 hover:bg-[#FCFAF7]"
                    >
                      <td className="px-5 py-4">
                        <span className="font-semibold text-[#4A2C20]">
                          #{order.id}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#1F1B18]">
                            {order.receiverName}
                          </p>

                          <p className="mt-1 truncate text-xs text-[#8A817B]">
                            {order.receiverPhone}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#C9894B]">
                            {order.fulfillmentMethod === "PICKUP"
                              ? "Đến quán lấy"
                              : "Giao hàng"}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-semibold text-[#4A2C20]">
                        {formatCurrency(order.totalPrice)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex min-w-[110px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${getPaymentClass(
                            order,
                          )}`}
                        >
                          {getPaymentLabel(order)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex min-w-[105px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                            order.status,
                          )}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-[#5E5650]">
                        {formatDate(order.createdAt)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            title="Xem chi tiết"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F7F2EC] text-[#5F7254] transition hover:bg-[#EAF3E7] hover:text-[#3F5D38]"
                          >
                            <Eye size={17} strokeWidth={2.2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-sm text-[#78866B]">
          Hiển thị{" "}
          <span className="font-semibold text-[#1F1B18]">
            {filteredOrders.length}
          </span>{" "}
          / {orders.length} đơn hàng
        </p>
      )}

      <OrderDetailModal
        open={selectedOrder !== null}
        order={selectedOrder}
        updating={updatingOrderId !== null}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={handleUpdateStatus}
        onCancelOrder={handleCancelOrder}
      />
    </div>
  );
}
