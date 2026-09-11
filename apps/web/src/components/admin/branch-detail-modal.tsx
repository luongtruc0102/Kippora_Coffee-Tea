"use client";

import {
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Pencil,
  Phone,
  Power,
  UserCog,
  Users,
  X,
} from "lucide-react";

import type { BranchStatus } from "@/types/store-settings";

type Props = {
  open: boolean;
  branch: BranchStatus | null;
  onClose: () => void;
  onEdit: (branch: BranchStatus) => void;
};

function formatDate(value: string | null) {
  if (!value) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function BranchDetailModal({
  open,
  branch,
  onClose,
  onEdit,
}: Props) {
  if (!open || !branch) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
        <div className="relative border-b border-[#E9E1D8] bg-gradient-to-r from-[#F7EFE6] via-[#FCF8F3] to-white px-7 py-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[#78866B] shadow-sm hover:text-[#4A2C20]"
          >
            <X size={19} />
          </button>

          <div className="flex items-start gap-4 pr-12">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#4A2C20] text-white shadow-sm">
              <Building2 size={26} />
            </div>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#C9894B]">
                {branch.code}
              </p>
              <h3 className="mt-1 text-2xl font-bold text-[#1F1B18]">
                {branch.name}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge
                  active={branch.isActive}
                  activeLabel="Đang hoạt động"
                  inactiveLabel="Đã khóa"
                />
                <StatusBadge
                  active={branch.isAcceptingOrders}
                  activeLabel="Đang nhận đơn"
                  inactiveLabel="Tạm nghỉ nhận đơn"
                  warning
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-7">
          <section>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#78866B]">
              Thông tin chi nhánh
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={<MapPin size={18} />}
                label="Địa chỉ"
                value={branch.address || "Chưa cập nhật"}
                full
              />
              <InfoCard
                icon={<Phone size={18} />}
                label="Số điện thoại"
                value={branch.phone || "Chưa cập nhật"}
              />
              <InfoCard
                icon={<CalendarDays size={18} />}
                label="Ngày mở chi nhánh"
                value={formatDate(branch.openedAt)}
              />
            </div>
          </section>

          <section>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#78866B]">
              Nhân sự
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={<UserCog size={18} />}
                label="Nhân viên trưởng"
                value={
                  branch.manager
                    ? branch.manager.fullName || branch.manager.email
                    : "Chưa phân công"
                }
              />
              <InfoCard
                icon={<Users size={18} />}
                label="Nhân viên"
                value={`${branch.activeStaffCount}/${branch.staffCount} đang hoạt động`}
              />
            </div>
          </section>

          <section>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#78866B]">
              Vận hành hệ thống
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={<Power size={18} />}
                label="Nhận đơn"
                value={
                  branch.isAcceptingOrders
                    ? "Đang nhận đơn"
                    : branch.pauseReason || "Đang tạm nghỉ"
                }
              />
              <InfoCard
                icon={<Clock3 size={18} />}
                label="Ngày tạo trên hệ thống"
                value={formatDate(branch.createdAt)}
              />
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#E9E1D8] bg-white px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] hover:bg-[#FAF8F5]"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => onEdit(branch)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#382118]"
          >
            <Pencil size={16} />
            Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
  warning = false,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  warning?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-100 text-emerald-700"
          : warning
            ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-600"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
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
