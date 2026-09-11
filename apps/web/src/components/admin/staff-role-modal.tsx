"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, ShieldCheck, UserRound, X } from "lucide-react";

import ToastMessage from "@/components/ui/toast-message";
import { getBranches } from "@/services/store-settings.service";
import { updateStaffAssignment } from "@/services/user.service";
import type { BranchStatus } from "@/types/store-settings";
import type { AdminUser, UserRole } from "@/types/user";

type StaffRole = Extract<UserRole, "STAFF" | "BRANCH_MANAGER">;

type Props = {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export default function StaffRoleModal({
  open,
  user,
  onClose,
  onSaved,
}: Props) {
  const [role, setRole] = useState<StaffRole>("STAFF");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !user) return;

    const controller = new AbortController();
    const resetFormId = window.setTimeout(() => {
      setRole(user.role.name === "BRANCH_MANAGER" ? "BRANCH_MANAGER" : "STAFF");
      setBranchId(user.branch ? String(user.branch.id) : "");
      setError("");
    }, 0);

    async function loadBranches() {
      try {
        setLoadingBranches(true);
        const accessToken = sessionStorage.getItem("accessToken");
        if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");

        setBranches(await getBranches(accessToken, controller.signal));
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải danh sách chi nhánh",
        );
      } finally {
        if (!controller.signal.aborted) setLoadingBranches(false);
      }
    }

    void loadBranches();

    return () => {
      controller.abort();
      window.clearTimeout(resetFormId);
    };
  }, [open, user]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    const selectedBranchId = Number(branchId);
    if (!Number.isInteger(selectedBranchId) || selectedBranchId < 1) {
      setError("Vui lòng chọn chi nhánh cho nhân viên.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");

      await updateStaffAssignment(accessToken, user.id, {
        branchId: selectedBranchId,
        role,
      });

      await onSaved();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể cập nhật phân công nhân viên",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E9E1D8] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E9E1D8] px-6 py-4">
          <div>
            <h3 className="text-xl font-semibold text-[#1F1B18]">
              Đổi vai trò và chi nhánh
            </h3>
            <p className="mt-1 text-sm text-[#78866B]">
              {user.fullName || user.email}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#78866B] hover:bg-[#FAF8F5]"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <ToastMessage message={error} />

          <div>
            <label
              htmlFor="staff-assignment-branch"
              className="mb-2 block text-sm font-semibold text-[#4A2C20]"
            >
              Chi nhánh phụ trách
            </label>
            <div className="relative">
              <Building2
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#C9894B]"
              />
              <select
                id="staff-assignment-branch"
                value={branchId}
                disabled={loadingBranches || saving}
                onChange={(event) => setBranchId(event.target.value)}
                className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#C9894B] disabled:cursor-wait disabled:bg-[#FAF8F5]"
              >
                <option value="">
                  {loadingBranches ? "Đang tải chi nhánh..." : "Chọn chi nhánh"}
                </option>
                {branches.map((branch) => (
                  <option
                    key={branch.id}
                    value={branch.id}
                    disabled={!branch.isActive}
                  >
                    {branch.code} - {branch.name}
                    {!branch.isActive ? " (Đã khóa)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-[#4A2C20]">Vai trò</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRole("STAFF")}
                className={`cursor-pointer rounded-2xl border p-4 text-left transition ${
                  role === "STAFF"
                    ? "border-[#C9894B] bg-[#FFF8F0]"
                    : "border-[#E9E1D8] hover:border-[#D7C5B4]"
                }`}
              >
                <UserRound size={21} className="text-[#C9894B]" />
                <p className="mt-3 font-semibold text-[#1F1B18]">Nhân viên</p>
                <p className="mt-1 text-xs leading-5 text-[#78866B]">
                  Xử lý đơn và làm việc tại chi nhánh đã chọn.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole("BRANCH_MANAGER")}
                className={`cursor-pointer rounded-2xl border p-4 text-left transition ${
                  role === "BRANCH_MANAGER"
                    ? "border-[#C9894B] bg-[#FFF8F0]"
                    : "border-[#E9E1D8] hover:border-[#D7C5B4]"
                }`}
              >
                <ShieldCheck size={21} className="text-[#C9894B]" />
                <p className="mt-3 font-semibold text-[#1F1B18]">
                  Nhân viên trưởng
                </p>
                <p className="mt-1 text-xs leading-5 text-[#78866B]">
                  Quản lý nhân viên và chấm công tại chi nhánh.
                </p>
              </button>
            </div>
          </div>

          {role === "BRANCH_MANAGER" && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Mỗi chi nhánh chỉ có một nhân viên trưởng. Nếu chi nhánh đã có
              trưởng, người cũ sẽ tự động trở về vai trò Nhân viên.
            </p>
          )}

          {user.branch && branchId !== String(user.branch.id) && (
            <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-700">
              Nhân viên sẽ được chuyển khỏi {user.branch.name} sau khi lưu. Cần
              kết thúc ca làm đang mở trước khi chuyển chi nhánh.
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[#F0E8E0] pt-5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] hover:bg-[#FAF8F5]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || loadingBranches}
              className="cursor-pointer rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#382118] disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : "Lưu phân công"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
