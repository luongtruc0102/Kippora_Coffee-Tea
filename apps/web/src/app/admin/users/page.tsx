"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Eye,
  LockKeyhole,
  Search,
  UnlockKeyhole,
} from "lucide-react";

import UserDetailModal from "@/components/admin/user-detail-modal";
import ToastMessage from "@/components/ui/toast-message";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  getAdminUserById,
  getAdminUsers,
  updateUserStatus,
} from "@/services/user.service";
import type { AdminUser } from "@/types/user";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatLastPurchase(value: string | null | undefined) {
  if (!value) return "Chưa mua hàng";

  const purchaseDate = new Date(value);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfPurchase = new Date(
    purchaseDate.getFullYear(),
    purchaseDate.getMonth(),
    purchaseDate.getDate(),
  );
  const days = Math.floor(
    (startOfToday.getTime() - startOfPurchase.getTime()) / 86_400_000,
  );

  if (days === 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days > 1 && days <= 7) return `${days} ngày trước`;
  return formatDate(value);
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const loadCustomers = useCallback(
    async (query = "", signal?: AbortSignal) => {
      await Promise.resolve();

      try {
        setLoading(true);
        setError("");
        const accessToken = sessionStorage.getItem("accessToken");
        if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");

        const data = await getAdminUsers(accessToken, query, signal);
        setCustomers(data.filter((user) => user.role.name === "USER"));
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải khách hàng",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => void loadCustomers(debouncedSearch, controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [debouncedSearch, loadCustomers]);

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          selectedStatus === "ALL" ||
          (selectedStatus === "ACTIVE" && customer.isActive) ||
          (selectedStatus === "INACTIVE" && !customer.isActive),
      ),
    [customers, selectedStatus],
  );

  async function handleOpenDetail(userId: number) {
    try {
      setError("");
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");
      setSelectedUser(await getAdminUserById(accessToken, userId));
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "Không thể tải chi tiết khách hàng",
      );
    }
  }

  async function handleToggleStatus(customer: AdminUser) {
    try {
      setUpdatingId(customer.id);
      setError("");
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");
      const updated = await updateUserStatus(
        accessToken,
        customer.id,
        !customer.isActive,
      );
      setCustomers((current) =>
        current.map((item) =>
          item.id === customer.id
            ? { ...item, isActive: updated.isActive }
            : item,
        ),
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Không thể cập nhật trạng thái khách hàng",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-[#1F1B18]">
          Quản lý khách hàng
        </h2>
        <p className="mt-1 text-[#78866B]">
          Theo dõi hoạt động mua hàng, điểm tích lũy và trạng thái tài khoản.
        </p>
      </div>

      <ToastMessage message={error} />

      <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none focus:border-[#C9894B]"
            />
          </div>
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm outline-none focus:border-[#C9894B]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Đã khóa</option>
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
          <div className="p-6 text-sm text-[#78866B]">
            Đang tải khách hàng...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] table-fixed">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[15%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="bg-[#FAF8F5]">
                <tr className="border-b border-[#E9E1D8] text-left text-xs font-semibold uppercase tracking-wide text-[#78866B]">
                  <th className="px-5 py-4">Khách hàng</th>
                  <th className="px-5 py-4">Số điện thoại</th>
                  <th className="px-5 py-4">Lần mua gần nhất</th>
                  <th className="px-5 py-4">Ngày tham gia</th>
                  <th className="px-5 py-4">Điểm</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm text-[#78866B]"
                    >
                      Không tìm thấy khách hàng.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-[#F0E8E0] last:border-b-0 hover:bg-[#FCFAF7]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {customer.avatarUrl ? (
                            <Image
                              unoptimized
                              src={customer.avatarUrl}
                              alt={customer.fullName ?? "Avatar"}
                              width={40}
                              height={40}
                              className="h-10 w-10 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E9DE] text-sm font-semibold text-[#4A2C20]">
                              {(customer.fullName || customer.email)
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#1F1B18]">
                              {customer.fullName || "Chưa cập nhật tên"}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#8A817B]">
                              {customer.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#5E5650]">
                        {customer.phone || "Chưa cập nhật"}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-[#5E5650]">
                        {formatLastPurchase(customer.lastPurchaseAt)}
                      </td>
                      <td className="px-5 py-4 text-sm text-[#5E5650]">
                        {formatDate(customer.createdAt)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#C9894B]">
                        {customer.loyaltyPoints.toLocaleString("vi-VN")} điểm
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex min-w-[105px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            customer.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {customer.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleOpenDetail(customer.id)}
                            title="Xem chi tiết"
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-[#F7F2EC] text-[#5F7254] hover:bg-[#EAF3E7]"
                          >
                            <Eye size={17} />
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === customer.id}
                            onClick={() => void handleToggleStatus(customer)}
                            title={
                              customer.isActive
                                ? "Khóa tài khoản"
                                : "Mở tài khoản"
                            }
                            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg disabled:cursor-wait disabled:opacity-50 ${
                              customer.isActive
                                ? "bg-[#FFF1F1] text-[#C85C5C] hover:bg-[#FFE4E4]"
                                : "bg-[#EAF6EE] text-[#4F8A63] hover:bg-[#DDF0E3]"
                            }`}
                          >
                            {customer.isActive ? (
                              <LockKeyhole size={17} />
                            ) : (
                              <UnlockKeyhole size={17} />
                            )}
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
          <strong className="text-[#1F1B18]">{filteredCustomers.length}</strong>{" "}
          / {customers.length} khách hàng
        </p>
      )}

      <UserDetailModal
        open={selectedUser !== null}
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}
