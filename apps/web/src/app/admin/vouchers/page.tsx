"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ChevronDown,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  UnlockKeyhole,
} from "lucide-react";

import {
  getAdminVouchers,
  updateVoucherStatus,
} from "@/services/voucher.service";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Voucher } from "@/types/voucher";
import VoucherFormModal from "@/components/admin/voucher-form-modal";
import ToastMessage from "@/components/ui/toast-message";

type ValidityFilter = "ALL" | "UPCOMING" | "ACTIVE" | "EXPIRED";

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const [selectedValidity, setSelectedValidity] =
    useState<ValidityFilter>("ALL");

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);

  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);

  const loadVouchers = useCallback(async (query = "", signal?: AbortSignal) => {
    await Promise.resolve();

    try {
      setLoading(true);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const data = await getAdminVouchers(accessToken, query, signal);

      setVouchers(data);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setError(
        error instanceof Error ? error.message : "Không thể tải voucher",
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
      void loadVouchers(debouncedSearch, controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [debouncedSearch, loadVouchers]);

  const filteredVouchers = useMemo(() => {
    const now = new Date().getTime();

    return vouchers.filter((voucher) => {
      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "ACTIVE" && voucher.isActive) ||
        (selectedStatus === "INACTIVE" && !voucher.isActive);

      const matchesValidity = voucher.isSystemVoucher
        ? selectedValidity === "ALL" || selectedValidity === "ACTIVE"
        : (() => {
            const startAt = new Date(voucher.startAt!).getTime();

            const endAt = new Date(voucher.endAt!).getTime();

            return (
              selectedValidity === "ALL" ||
              (selectedValidity === "UPCOMING" && now < startAt) ||
              (selectedValidity === "ACTIVE" &&
                now >= startAt &&
                now <= endAt) ||
              (selectedValidity === "EXPIRED" && now > endAt)
            );
          })();

      return matchesStatus && matchesValidity;
    });
  }, [vouchers, selectedStatus, selectedValidity]);

  function formatCurrency(value: number | string | null) {
    if (value === null) {
      return "—";
    }

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
    }).format(new Date(value));
  }

  function getDiscountLabel(voucher: Voucher) {
    if (voucher.discountType === "PERCENT") {
      return `${Number(voucher.discountValue)}%`;
    }

    return formatCurrency(voucher.discountValue);
  }

  function getValidity(voucher: Voucher) {
    if (voucher.isSystemVoucher) {
      return {
        label: "Đặc quyền Staff",
        className: "bg-violet-50 text-violet-700",
      };
    }

    if (!voucher.isActive) {
      return {
        label: "Đã khóa",
        className: "bg-red-50 text-red-600",
      };
    }

    const now = new Date().getTime();

    const startAt = new Date(voucher.startAt!).getTime();

    const endAt = new Date(voucher.endAt!).getTime();

    if (now < startAt) {
      return {
        label: "Chưa hiệu lực",
        className: "bg-blue-50 text-blue-700",
      };
    }

    if (now > endAt) {
      return {
        label: "Hết hạn",
        className: "bg-red-50 text-red-600",
      };
    }

    return {
      label: "Còn hiệu lực",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  async function handleToggleStatus(voucher: Voucher) {
    try {
      setError("");
      setUpdatingId(voucher.id);

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const updated = await updateVoucherStatus(
        accessToken,
        voucher.id,
        !voucher.isActive,
      );

      // Chỉ cập nhật voucher vừa đổi trạng thái để tránh giật bảng
      setVouchers((current) =>
        current.map((item) =>
          item.id === voucher.id
            ? {
                ...item,
                isActive: updated.isActive,
              }
            : item,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái voucher",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#1F1B18]">Quản lý voucher</h2>

          <p className="mt-1 text-[#78866B]">
            Quản lý mã giảm giá và thời gian áp dụng.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingVoucher(null);
            setFormOpen(true);
          }}
          className="flex w-fit items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
        >
          <Plus size={18} />
          Thêm voucher
        </button>
      </div>

      <ToastMessage message={error} />

      <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_210px_210px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã voucher..."
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

              <option value="ACTIVE">Đang bật</option>

              <option value="INACTIVE">Đã khóa</option>
            </select>

            <ChevronDown
              size={18}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5E5650]"
            />
          </div>

          <div className="relative">
            <select
              value={selectedValidity}
              onChange={(event) =>
                setSelectedValidity(event.target.value as ValidityFilter)
              }
              className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm outline-none focus:border-[#C9894B]"
            >
              <option value="ALL">Tất cả hiệu lực</option>

              <option value="UPCOMING">Chưa hiệu lực</option>

              <option value="ACTIVE">Còn hiệu lực</option>

              <option value="EXPIRED">Hết hạn</option>
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
          <div className="p-6 text-sm text-[#78866B]">Đang tải voucher...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
              </colgroup>

              <thead className="bg-[#FAF8F5]">
                <tr className="border-b border-[#E9E1D8] text-left text-xs font-semibold uppercase tracking-wide text-[#78866B]">
                  <th className="px-5 py-4">Voucher</th>

                  <th className="px-5 py-4">Giảm</th>

                  <th className="px-5 py-4">Điều kiện</th>

                  <th className="px-5 py-4">Lượt dùng</th>

                  <th className="px-5 py-4">Thời hạn</th>

                  <th className="px-5 py-4">Hiệu lực</th>

                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm text-[#78866B]"
                    >
                      Không tìm thấy voucher.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((voucher) => {
                    const validity = getValidity(voucher);

                    return (
                      <tr
                        key={voucher.id}
                        className="border-b border-[#F0E8E0] transition-colors last:border-b-0 hover:bg-[#FCFAF7]"
                      >
                        <td className="px-5 py-4">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#4A2C20]">
                              {voucher.code}
                            </p>

                            <p className="mt-1 truncate text-xs text-[#8A817B]">
                              {voucher.description || "Không có mô tả"}
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-bold text-[#C9894B]">
                            {getDiscountLabel(voucher)}
                          </span>

                          {voucher.discountType === "PERCENT" &&
                            voucher.maxDiscount !== null && (
                              <p className="mt-1 text-xs text-[#8A817B]">
                                Tối đa {formatCurrency(voucher.maxDiscount)}
                              </p>
                            )}
                        </td>

                        <td className="px-5 py-4 text-sm text-[#5E5650]">
                          {voucher.minOrderValue !== null
                            ? `Từ ${formatCurrency(voucher.minOrderValue)}`
                            : "Không yêu cầu"}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-[#1F1B18]">
                            {voucher.usedCount}
                            {" / "}
                            {voucher.usageLimit ?? "∞"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-[#5E5650]">
                          {voucher.isSystemVoucher ? (
                            <span className="font-medium text-[#78866B]">
                              Không giới hạn
                            </span>
                          ) : (
                            <>
                              <p>{formatDate(voucher.startAt!)}</p>

                              <p className="mt-1 text-xs text-[#8A817B]">
                                đến {formatDate(voucher.endAt!)}
                              </p>
                            </>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {voucher.isSystemVoucher ? (
                            <span className="inline-flex min-w-[105px] justify-center rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                              Đặc quyền Staff
                            </span>
                          ) : (
                            <span
                              className={`inline-flex min-w-[105px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${validity.className}`}
                            >
                              {validity.label}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {voucher.isSystemVoucher ? (
                            <div className="flex justify-end">
                              <span className="rounded-lg bg-[#F7F2EC] px-3 py-2 text-xs font-semibold text-[#78866B]">
                                Hệ thống
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVoucher(voucher);

                                  setFormOpen(true);
                                }}
                                title="Chỉnh sửa"
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF6EC] text-[#C9894B] transition hover:bg-[#FBE8D4] hover:text-[#A9682F]"
                              >
                                <Pencil size={17} strokeWidth={2.2} />
                              </button>

                              <button
                                type="button"
                                disabled={updatingId === voucher.id}
                                onClick={() => handleToggleStatus(voucher)}
                                title={
                                  voucher.isActive
                                    ? "Khóa voucher"
                                    : "Mở lại voucher"
                                }
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-wait disabled:opacity-50 ${
                                  voucher.isActive
                                    ? "bg-[#FFF1F1] text-[#C85C5C] hover:bg-[#FFE4E4]"
                                    : "bg-[#EAF6EE] text-[#4F8A63] hover:bg-[#DDF0E3]"
                                }`}
                              >
                                {voucher.isActive ? (
                                  <LockKeyhole size={17} />
                                ) : (
                                  <UnlockKeyhole size={17} />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
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
            {filteredVouchers.length}
          </span>{" "}
          / {vouchers.length} voucher
        </p>
      )}

      <VoucherFormModal
        open={formOpen}
        mode={editingVoucher ? "edit" : "create"}
        voucher={editingVoucher}
        onClose={() => {
          setFormOpen(false);
          setEditingVoucher(null);
        }}
        onSaved={() => {
          void loadVouchers(debouncedSearch);
        }}
      />
    </div>
  );
}
