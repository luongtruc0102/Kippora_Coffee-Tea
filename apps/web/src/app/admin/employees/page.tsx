"use client";

import Image from "next/image";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ChevronDown,
  Eye,
  LockKeyhole,
  Plus,
  Search,
  UnlockKeyhole,
  UserCog,
} from "lucide-react";

import {
  getAdminUsers,
  getAdminUserById,
  updateUserStatus,
} from "@/services/user.service";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { AdminUser } from "@/types/user";
import StaffFormModal from "@/components/admin/staff-form-modal";
import StaffRoleModal from "@/components/admin/staff-role-modal";
import UserDetailModal from "@/components/admin/user-detail-modal";
import ToastMessage from "@/components/ui/toast-message";

export default function AdminEmployeesPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [staffFormOpen, setStaffFormOpen] = useState(false);

  const [roleUser, setRoleUser] = useState<AdminUser | null>(null);

  const [selectedRole, setSelectedRole] = useState("ALL");

  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const loadUsers = useCallback(async (query = "", signal?: AbortSignal) => {
    await Promise.resolve();

    try {
      setLoading(true);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const data = await getAdminUsers(accessToken, query, signal);

      setUsers(
        data.filter(
          (user) =>
            user.role.name === "STAFF" || user.role.name === "BRANCH_MANAGER",
        ),
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setError(
        error instanceof Error ? error.message : "Không thể tải nhân viên",
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
      void loadUsers(debouncedSearch, controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [debouncedSearch, loadUsers]);

  async function handleOpenUserDetail(userId: number) {
    try {
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const user = await getAdminUserById(accessToken, userId);

      setSelectedUser(user);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể tải chi tiết nhân viên",
      );
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesRole =
        selectedRole === "ALL" || user.role.name === selectedRole;

      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "ACTIVE" && user.isActive) ||
        (selectedStatus === "INACTIVE" && !user.isActive);

      return matchesRole && matchesStatus;
    });
  }, [users, selectedRole, selectedStatus]);

  async function handleToggleStatus(user: AdminUser) {
    try {
      setError("");
      setUpdatingId(user.id);

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const updated = await updateUserStatus(
        accessToken,
        user.id,
        !user.isActive,
      );

      // Không reload toàn bảng để UI không bị giật
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                isActive: updated.isActive,
                updatedAt: updated.updatedAt,
              }
            : item,
        ),
      );

      setSelectedUser((current) =>
        current?.id === user.id
          ? {
              ...current,
              isActive: updated.isActive,
              updatedAt: updated.updatedAt,
            }
          : current,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái nhân viên",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#1F1B18]">
            Quản lý nhân viên
          </h2>

          <p className="mt-1 text-[#78866B]">
            Quản lý chi nhánh, vai trò và trạng thái tài khoản nhân viên.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStaffFormOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
        >
          <Plus size={18} />
          Thêm nhân viên
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
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none transition focus:border-[#C9894B]"
            />
          </div>

          <div className="relative">
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm outline-none focus:border-[#C9894B]"
            >
              <option value="ALL">Tất cả vai trò</option>

              <option value="BRANCH_MANAGER">Nhân viên trưởng</option>

              <option value="STAFF">Nhân viên</option>
            </select>

            <ChevronDown
              size={18}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5E5650]"
            />
          </div>

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm outline-none focus:border-[#C9894B]"
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
            Đang tải nhân viên...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[15%]" />
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[15%]" />
              </colgroup>

              <thead className="bg-[#FAF8F5]">
                <tr className="border-b border-[#E9E1D8] text-left text-xs font-semibold uppercase tracking-wide text-[#78866B]">
                  <th className="px-5 py-4">Nhân viên</th>

                  <th className="px-5 py-4">Số điện thoại</th>

                  <th className="px-5 py-4">Chi nhánh</th>

                  <th className="px-5 py-4">Vai trò</th>

                  <th className="px-5 py-4">Trạng thái</th>

                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-sm text-[#78866B]"
                    >
                      Không tìm thấy nhân viên.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-[#F0E8E0] transition-colors last:border-b-0 hover:bg-[#FCFAF7]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {user.avatarUrl ? (
                            <Image
                              unoptimized
                              src={user.avatarUrl}
                              alt={user.fullName ?? "Avatar"}
                              width={40}
                              height={40}
                              className="h-10 w-10 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E9DE] text-sm font-semibold text-[#4A2C20]">
                              {(user.fullName || user.email)
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#1F1B18]">
                              {user.fullName || "Chưa cập nhật tên"}
                            </p>

                            <p className="mt-1 truncate text-xs text-[#8A817B]">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-[#5E5650]">
                        {user.phone || "Chưa cập nhật"}
                      </td>

                      <td className="px-5 py-4">
                        {user.branch ? (
                          <div>
                            <p className="font-semibold text-[#4A2C20]">
                              {user.branch.code}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#8A817B]">
                              {user.branch.name}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-red-500">
                            Chưa gắn chi nhánh
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex min-w-[95px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.role.name === "ADMIN"
                              ? "bg-violet-50 text-violet-700"
                              : user.role.name === "BRANCH_MANAGER"
                                ? "bg-amber-50 text-amber-700"
                                : user.role.name === "STAFF"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-[#F7F2EC] text-[#4A2C20]"
                          }`}
                        >
                          {user.role.name === "ADMIN"
                            ? "Admin"
                            : user.role.name === "BRANCH_MANAGER"
                              ? "Nhân viên trưởng"
                              : user.role.name === "STAFF"
                                ? "Nhân viên"
                                : "Khách hàng"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex min-w-[105px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {user.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenUserDetail(user.id)}
                            title="Xem chi tiết"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F7F2EC] text-[#5F7254] transition hover:bg-[#EAF3E7] hover:text-[#3F5D38]"
                          >
                            <Eye size={17} strokeWidth={2.2} />
                          </button>

                          {(user.role.name === "STAFF" ||
                            user.role.name === "BRANCH_MANAGER") && (
                            <button
                              type="button"
                              onClick={() => setRoleUser(user)}
                              title="Đổi vai trò nhân viên"
                              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-amber-50 text-amber-700 transition hover:bg-amber-100"
                            >
                              <UserCog size={17} strokeWidth={2.2} />
                            </button>
                          )}
                          {user.role.name !== "ADMIN" && (
                            <button
                              type="button"
                              disabled={updatingId === user.id}
                              onClick={() => handleToggleStatus(user)}
                              title={
                                user.isActive
                                  ? "Khóa tài khoản"
                                  : "Mở lại tài khoản"
                              }
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition disabled:cursor-wait disabled:opacity-50 ${
                                user.isActive
                                  ? "bg-[#FFF1F1] text-[#C85C5C] hover:bg-[#FFE4E4]"
                                  : "bg-[#EAF6EE] text-[#4F8A63] hover:bg-[#DDF0E3]"
                              }`}
                            >
                              {user.isActive ? (
                                <LockKeyhole size={17} />
                              ) : (
                                <UnlockKeyhole size={17} />
                              )}
                            </button>
                          )}
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
            {filteredUsers.length}
          </span>{" "}
          / {users.length} nhân viên
        </p>
      )}

      <UserDetailModal
        open={selectedUser !== null}
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
      />

      {roleUser && (
        <StaffRoleModal
          open
          user={roleUser}
          onClose={() => setRoleUser(null)}
          onSaved={() => loadUsers(debouncedSearch)}
        />
      )}
      <StaffFormModal
        open={staffFormOpen}
        onClose={() => setStaffFormOpen(false)}
        onSaved={() => {
          void loadUsers(debouncedSearch);
        }}
      />
    </div>
  );
}
