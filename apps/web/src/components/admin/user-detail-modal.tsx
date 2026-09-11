"use client";

import Image from "next/image";

import {
  BadgePercent,
  CalendarDays,
  Clock3,
  Mail,
  Phone,
  ShoppingBag,
  Star,
  WalletCards,
  X,
} from "lucide-react";

import type { AdminUser } from "@/types/user";

type Props = {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function formatWorkedTime(seconds: number | undefined) {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return "Chưa có dữ liệu";
  }
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours} giờ ${minutes} phút ${total % 60} giây`;
}

function getOrderStatusMeta(status: string) {
  switch (status) {
    case "PENDING":
      return {
        label: "Chờ xác nhận",
        className: "bg-amber-50 text-amber-700",
      };

    case "CONFIRMED":
      return {
        label: "Đã xác nhận",
        className: "bg-blue-50 text-blue-700",
      };

    case "PREPARING":
      return {
        label: "Đang chuẩn bị",
        className: "bg-orange-50 text-orange-700",
      };

    case "READY_FOR_PICKUP":
      return {
        label: "Sẵn sàng nhận",
        className: "bg-teal-50 text-teal-700",
      };

    case "DELIVERING":
      return {
        label: "Đang giao",
        className: "bg-violet-50 text-violet-700",
      };

    case "COMPLETED":
      return {
        label: "Hoàn tất",
        className: "bg-emerald-50 text-emerald-700",
      };

    case "CANCELLED":
      return {
        label: "Đã hủy",
        className: "bg-red-50 text-red-600",
      };

    default:
      return {
        label: status,
        className: "bg-[#F3F0ED] text-[#78866B]",
      };
  }
}

export default function UserDetailModal({ open, user, onClose }: Props) {
  if (!open || !user) {
    return null;
  }

  const isCustomer = user.role.name === "USER";

  const isStaff =
    user.role.name === "STAFF" || user.role.name === "BRANCH_MANAGER";

  const hasPurchaseInfo = isCustomer || isStaff;

  const roleLabel =
    user.role.name === "ADMIN"
      ? "Admin"
      : user.role.name === "BRANCH_MANAGER"
        ? "Nhân viên trưởng"
        : user.role.name === "STAFF"
          ? "Nhân viên"
          : "Khách hàng";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
        <div className="relative bg-gradient-to-r from-[#F7EFE6] via-[#FCF8F3] to-white px-7 py-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#78866B] shadow-sm transition hover:bg-white hover:text-[#4A2C20]"
          >
            <X size={19} />
          </button>

          <div className="flex items-center gap-5">
            {user.avatarUrl ? (
              <Image
                unoptimized
                src={user.avatarUrl}
                alt={user.fullName ?? "Avatar"}
                width={80}
                height={80}
                className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-4 ring-white"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#4A2C20] text-2xl font-bold text-white ring-4 ring-white">
                {(user.fullName || user.email).charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <h3 className="truncate text-2xl font-bold text-[#1F1B18]">
                {user.fullName || "Chưa cập nhật tên"}
              </h3>

              <p className="mt-1 truncate text-sm text-[#78866B]">
                {user.email}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    user.role.name === "ADMIN"
                      ? "bg-violet-100 text-violet-700"
                      : user.role.name === "BRANCH_MANAGER"
                        ? "bg-amber-100 text-amber-700"
                        : user.role.name === "STAFF"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-[#F3E9DE] text-[#4A2C20]"
                  }`}
                >
                  {roleLabel}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    user.isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {user.isActive ? "Đang hoạt động" : "Đã khóa"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-7">
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#78866B]">
              Thông tin cá nhân
            </h4>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={<Phone size={18} />}
                label="Số điện thoại"
                value={user.phone || "Chưa cập nhật"}
              />

              <InfoCard
                icon={<CalendarDays size={18} />}
                label="Ngày tạo"
                value={formatDate(user.createdAt)}
              />

              <InfoCard
                icon={<Mail size={18} />}
                label="Email"
                value={user.email}
                full
              />
            </div>
          </div>

          {isStaff && (
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#78866B]">
                Thông tin làm việc
              </h4>
              <StatCard
                icon={<Clock3 size={19} />}
                label="Tổng thời gian làm"
                value={formatWorkedTime(user.totalWorkedSeconds)}
              />
              <p className="mt-3 text-sm leading-6 text-[#8A817B]">
                Tổng các ca đã kết thúc ở tất cả chi nhánh. Ca đang làm chỉ
                được cộng vào tổng sau khi kết thúc ca.
              </p>
            </div>
          )}

          {hasPurchaseInfo && (
            <div>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#78866B]">
                Thông tin mua hàng
              </h4>

              <div
                className={`grid gap-4 ${
                  isCustomer ? "sm:grid-cols-3" : "sm:grid-cols-2"
                }`}
              >
                {isCustomer && (
                  <StatCard
                    icon={<Star size={19} />}
                    label="Điểm tích lũy"
                    value={`${user.loyaltyPoints.toLocaleString("vi-VN")} điểm`}
                  />
                )}

                <StatCard
                  icon={<ShoppingBag size={19} />}
                  label="Tổng đơn"
                  value={String(user.purchaseSummary?.totalOrders ?? 0)}
                />

                <StatCard
                  icon={<WalletCards size={19} />}
                  label="Tổng chi tiêu"
                  value={formatCurrency(user.purchaseSummary?.totalSpent ?? 0)}
                />
              </div>

              {isStaff && (
                <div className="mt-4 rounded-2xl border border-[#E7D6C3] bg-[#FFF8F0] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#C9894B] shadow-sm">
                      <BadgePercent size={20} />
                    </div>

                    <div>
                      <p className="font-semibold text-[#4A2C20]">
                        Đặc quyền nhân viên
                      </p>

                      <p className="mt-1 text-sm leading-6 text-[#78866B]">
                        Nhân viên Kippora được sử dụng voucher giảm 20% dành
                        riêng cho nhân viên.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 overflow-hidden rounded-2xl border border-[#E9E1D8]">
                <div className="border-b border-[#E9E1D8] bg-[#FCFAF7] px-5 py-4">
                  <p className="font-semibold text-[#1F1B18]">
                    Hoạt động mua hàng gần đây
                  </p>
                </div>

                {user.recentOrders?.length ? (
                  <div className="divide-y divide-[#F0E8E0]">
                    {user.recentOrders.map((order) => {
                      const statusMeta = getOrderStatusMeta(order.status);

                      return (
                        <div
                          key={order.id}
                          className="flex items-center justify-between gap-4 px-5 py-4"
                        >
                          <div>
                            <p className="font-semibold text-[#4A2C20]">
                              Đơn #{order.id}
                            </p>

                            <p className="mt-1 text-xs text-[#8A817B]">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-semibold text-[#1F1B18]">
                              {formatCurrency(order.totalPrice)}
                            </p>

                            <span
                              className={`mt-2 inline-flex min-w-[100px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-sm text-[#8A817B]">
                    Chưa có đơn hàng.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end border-t border-[#E9E1D8] bg-white px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
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
  full = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-[#EEE5DC] bg-[#FCFAF7] p-4 ${
        full ? "sm:col-span-2" : ""
      }`}
    >
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

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#F0E0CF] bg-[#FFF8F0] p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#C9894B] shadow-sm">
        {icon}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#A87644]">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-[#4A2C20]">{value}</p>
    </div>
  );
}
