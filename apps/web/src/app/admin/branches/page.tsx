"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ChevronDown,
  Eye,
  LockKeyhole,
  MapPinned,
  Pencil,
  Plus,
  Search,
  UnlockKeyhole,
  UserCog,
  Users,
  X,
} from "lucide-react";

import BranchDetailModal from "@/components/admin/branch-detail-modal";
import ToastMessage from "@/components/ui/toast-message";
import { useAppToast } from "@/components/ui/app-toast-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  assignBranchManager,
  createBranch,
  getBranches,
  removeBranchManager,
  updateBranch,
  updateBranchActive,
} from "@/services/store-settings.service";
import type { BranchStatus } from "@/types/store-settings";
import type { AdminUser } from "@/types/user";
import { getAdminUsers } from "@/services/user.service";

const CODE_PATTERN = /^[A-Za-z0-9_-]{2,20}$/;
const PHONE_PATTERN = /^[0-9]{9,11}$/;
const DEFAULT_STORE_COORDINATES = {
  latitude: 10.8569371,
  longitude: 106.7465042,
};

const BranchLocationPicker = dynamic(
  () => import("@/components/user/delivery-route-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-2xl bg-[#F6F0E9] text-sm text-[#78866B]">
        Đang mở bản đồ...
      </div>
    ),
  },
);

export default function AdminBranchesPage() {
  const { showToast } = useAppToast();

  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [branchEmployees, setBranchEmployees] = useState<AdminUser[]>([]);
  const [managerBranch, setManagerBranch] = useState<BranchStatus | null>(null);
  const [managerUserId, setManagerUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchStatus | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<BranchStatus | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [openedAt, setOpenedAt] = useState("");

  const loadBranches = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve();

    try {
      setLoading(true);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const [branchData, userData] = await Promise.all([
        getBranches(accessToken, signal),
        getAdminUsers(accessToken, "", signal),
      ]);
      setBranches(branchData);
      setBranchEmployees(
        userData.filter(
          (user) =>
            user.role.name === "STAFF" || user.role.name === "BRANCH_MANAGER",
        ),
      );
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
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadBranches(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadBranches]);

  const filteredBranches = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    return branches.filter((branch) => {
      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "ACTIVE" && branch.isActive) ||
        (selectedStatus === "INACTIVE" && !branch.isActive);

      if (!matchesStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [branch.code, branch.name, branch.address, branch.phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword));
    });
  }, [branches, debouncedSearch, selectedStatus]);

  function openCreate() {
    setEditingBranch(null);
    setCode("");
    setName("");
    setAddress("");
    setPhone("");
    setLatitude("");
    setLongitude("");
    setOpenedAt("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(branch: BranchStatus) {
    setEditingBranch(branch);
    setCode(branch.code);
    setName(branch.name);
    setAddress(branch.address ?? "");
    setPhone(branch.phone ?? "");
    setLatitude(branch.latitude?.toString() ?? "");
    setLongitude(branch.longitude?.toString() ?? "");
    setOpenedAt(branch.openedAt?.slice(0, 10) ?? "");
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingBranch(null);
    setCode("");
    setName("");
    setAddress("");
    setPhone("");
    setLatitude("");
    setLongitude("");
    setOpenedAt("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      if (name.trim().length < 2) {
        throw new Error("Tên chi nhánh phải có ít nhất 2 ký tự.");
      }

      if (!editingBranch && !CODE_PATTERN.test(code.trim())) {
        throw new Error(
          "Mã chi nhánh gồm 2-20 ký tự chữ, số, gạch ngang hoặc gạch dưới.",
        );
      }

      if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) {
        throw new Error("Số điện thoại không hợp lệ.");
      }

      const hasLatitude = latitude.trim() !== "";
      const hasLongitude = longitude.trim() !== "";

      if (hasLatitude !== hasLongitude) {
        throw new Error("Vui lòng nhập đầy đủ cả vĩ độ và kinh độ.");
      }

      const parsedLatitude = hasLatitude ? Number(latitude) : null;
      const parsedLongitude = hasLongitude ? Number(longitude) : null;

      if (
        parsedLatitude !== null &&
        (!Number.isFinite(parsedLatitude) ||
          parsedLatitude < -90 ||
          parsedLatitude > 90)
      ) {
        throw new Error("Vĩ độ phải nằm trong khoảng -90 đến 90.");
      }

      if (
        parsedLongitude !== null &&
        (!Number.isFinite(parsedLongitude) ||
          parsedLongitude < -180 ||
          parsedLongitude > 180)
      ) {
        throw new Error("Kinh độ phải nằm trong khoảng -180 đến 180.");
      }

      if (editingBranch) {
        await updateBranch(accessToken, editingBranch.id, {
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          openedAt: openedAt || null,
        });
        showToast("Đã cập nhật chi nhánh", "success");
      } else {
        await createBranch(accessToken, {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          latitude: parsedLatitude ?? undefined,
          longitude: parsedLongitude ?? undefined,
          openedAt: openedAt || undefined,
        });
        showToast("Đã thêm chi nhánh", "success");
      }

      await loadBranches();
      setFormOpen(false);
      setEditingBranch(null);
      setCode("");
      setName("");
      setAddress("");
      setPhone("");
      setLatitude("");
      setLongitude("");
      setOpenedAt("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể lưu chi nhánh",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(branch: BranchStatus) {
    try {
      setError("");
      setUpdatingId(branch.id);

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      await updateBranchActive(accessToken, branch.id, !branch.isActive);

      await loadBranches();
      showToast(
        !branch.isActive ? "Đã mở lại chi nhánh" : "Đã khóa chi nhánh",
        "success",
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Không thể cập nhật trạng thái chi nhánh",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function openManagerForm(branch: BranchStatus) {
    setManagerBranch(branch);
    setManagerUserId(branch.manager ? String(branch.manager.id) : "");
    setError("");
  }

  async function handleSaveManager() {
    if (!managerBranch || !managerUserId) {
      setError("Vui lòng chọn nhân viên trưởng.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      await assignBranchManager(
        accessToken,
        managerBranch.id,
        Number(managerUserId),
      );
      await loadBranches();
      setManagerBranch(null);
      setManagerUserId("");
      showToast("Đã phân công nhân viên trưởng", "success");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể phân công nhân viên trưởng",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveManager() {
    if (!managerBranch?.manager) return;

    try {
      setSaving(true);
      setError("");
      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      await removeBranchManager(accessToken, managerBranch.id);
      await loadBranches();
      setManagerBranch(null);
      setManagerUserId("");
      showToast("Đã gỡ quyền nhân viên trưởng", "success");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Không thể gỡ nhân viên trưởng",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9894B]">
            Hệ thống
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#1F1B18]">
            Quản lý chi nhánh
          </h2>
          <p className="mt-1 text-[#78866B]">
            Tạo, phân công trưởng, chỉnh sửa và khóa chi nhánh. Staff vẫn tự tạm
            nghỉ nhận đơn từng điểm bán.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex w-fit items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
        >
          <Plus size={18} />
          Thêm chi nhánh
        </button>
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
              placeholder="Tìm theo mã, tên, địa chỉ hoặc số điện thoại..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none transition focus:border-[#C9894B]"
            />
          </div>

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm text-[#1F1B18] outline-none focus:border-[#C9894B]"
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
            Đang tải danh sách chi nhánh...
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[33%]" />
                <col className="w-[14%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-[#FAF8F5]">
                <tr className="border-b border-[#E9E1D8] text-left text-xs font-semibold uppercase tracking-wide text-[#78866B]">
                  <th className="px-6 py-4">Mã</th>
                  <th className="px-6 py-4">Chi nhánh</th>
                  <th className="px-6 py-4">Nhân viên</th>
                  <th className="px-6 py-4">Nhận đơn</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredBranches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-sm text-[#78866B]"
                    >
                      Không tìm thấy chi nhánh.
                    </td>
                  </tr>
                ) : (
                  filteredBranches.map((branch) => (
                    <tr
                      key={branch.id}
                      className="border-b border-[#F0E8E0] last:border-b-0 hover:bg-[#FCFAF7]"
                    >
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-[#4A2C20]">
                        {branch.code}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-[#1F1B18]">
                          {branch.name}
                        </p>
                        <p className="mt-1 text-xs text-[#8A817B]">
                          {branch.address || "Chưa có địa chỉ"}
                        </p>
                        <button
                          type="button"
                          onClick={() => openManagerForm(branch)}
                          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#C9894B] hover:text-[#9F642F]"
                        >
                          <UserCog size={14} />
                          {branch.manager
                            ? `Trưởng: ${branch.manager.fullName || branch.manager.email}`
                            : "Phân công nhân viên trưởng"}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Users
                            size={16}
                            className="shrink-0 text-[#C9894B]"
                          />
                          <div>
                            <p className="font-semibold text-[#1F1B18]">
                              {branch.activeStaffCount}/{branch.staffCount}
                            </p>
                            <p className="mt-0.5 text-xs text-[#8A817B]">
                              đang hoạt động
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex min-w-[110px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            branch.isAcceptingOrders
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {branch.isAcceptingOrders
                            ? "Đang nhận đơn"
                            : "Tạm nghỉ"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex min-w-[110px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            branch.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {branch.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedBranch(branch)}
                            title="Xem chi tiết"
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-[#F2F6EF] text-[#5F7254] transition hover:bg-[#E5EFE0]"
                          >
                            <Eye size={17} strokeWidth={2.2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(branch)}
                            title="Chỉnh sửa"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF6EC] text-[#C9894B] transition hover:bg-[#FBE8D4]"
                          >
                            <Pencil size={17} strokeWidth={2.2} />
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === branch.id}
                            onClick={() => void handleToggleStatus(branch)}
                            title={
                              branch.isActive
                                ? "Khóa chi nhánh"
                                : "Mở lại chi nhánh"
                            }
                            className={`flex h-9 w-9 items-center justify-center rounded-lg transition disabled:cursor-wait disabled:opacity-50 ${
                              branch.isActive
                                ? "bg-[#FFF1F1] text-[#C85C5C] hover:bg-[#FFE4E4]"
                                : "bg-[#EAF6EE] text-[#4F8A63] hover:bg-[#DDF0E3]"
                            }`}
                          >
                            {branch.isActive ? (
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
          <span className="font-semibold text-[#1F1B18]">
            {filteredBranches.length}
          </span>{" "}
          / {branches.length} chi nhánh
        </p>
      )}

      <BranchDetailModal
        open={selectedBranch !== null}
        branch={selectedBranch}
        onClose={() => setSelectedBranch(null)}
        onEdit={(branch) => {
          setSelectedBranch(null);
          openEdit(branch);
        }}
      />

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E9E1D8] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E9E1D8] px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-[#1F1B18]">
                  {editingBranch ? "Chỉnh sửa chi nhánh" : "Thêm chi nhánh"}
                </h3>
                <p className="mt-1 text-sm text-[#78866B]">
                  {editingBranch
                    ? "Cập nhật tên và thông tin liên hệ. Mã chi nhánh không đổi."
                    : "Tạo điểm bán mới. Staff sẽ tạm nghỉ nhận đơn theo từng chi nhánh."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#78866B] hover:bg-[#FAF8F5]"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                    Mã chi nhánh
                  </label>
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    disabled={Boolean(editingBranch)}
                    placeholder="Ví dụ: Q1"
                    className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm uppercase outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5] disabled:text-[#8A817B]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                    Số điện thoại
                  </label>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="0901234567"
                    className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none focus:border-[#C9894B]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPinned size={18} className="text-[#C9894B]" />
                  <div>
                    <p className="text-sm font-semibold text-[#1F1B18]">
                      Vị trí trên bản đồ
                    </p>
                    <p className="text-xs text-[#8A817B]">
                      Bấm vào bản đồ để lấy tọa độ chính xác cho trang Cửa hàng.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#E9E1D8]">
                  <BranchLocationPicker
                    storeCoordinates={
                      latitude && longitude
                        ? {
                            latitude: Number(latitude),
                            longitude: Number(longitude),
                          }
                        : DEFAULT_STORE_COORDINATES
                    }
                    customerCoordinates={null}
                    routeCoordinates={[]}
                    onLocationSelect={(coordinate) => {
                      setLatitude(coordinate.latitude.toFixed(7));
                      setLongitude(coordinate.longitude.toFixed(7));
                    }}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                      Vĩ độ
                    </label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={latitude}
                      onChange={(event) => setLatitude(event.target.value)}
                      placeholder="10.8569371"
                      className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none focus:border-[#C9894B]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                      Kinh độ
                    </label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={longitude}
                      onChange={(event) => setLongitude(event.target.value)}
                      placeholder="106.7465042"
                      className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none focus:border-[#C9894B]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                  Tên chi nhánh
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Kippora - Quận 1"
                  className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none focus:border-[#C9894B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                  Địa chỉ
                </label>
                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  rows={3}
                  placeholder="Địa chỉ điểm bán..."
                  className="w-full resize-none rounded-xl border border-[#E9E1D8] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                  Ngày mở chi nhánh
                </label>
                <input
                  type="date"
                  value={openedAt}
                  onChange={(event) => setOpenedAt(event.target.value)}
                  className="h-11 w-full cursor-pointer rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none focus:border-[#C9894B]"
                />
                <p className="mt-1.5 text-xs text-[#8A817B]">
                  Ngày khai trương thực tế, có thể để trống và cập nhật sau.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#F0E8E0] pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] hover:bg-[#FAF8F5]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118] disabled:cursor-wait disabled:opacity-60"
                >
                  {saving
                    ? "Đang lưu..."
                    : editingBranch
                      ? "Lưu thay đổi"
                      : "Thêm chi nhánh"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {managerBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E9E1D8] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E9E1D8] px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-[#1F1B18]">
                  Phân công nhân viên trưởng
                </h3>
                <p className="mt-1 text-sm text-[#78866B]">
                  {managerBranch.code} - {managerBranch.name}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setManagerBranch(null)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#78866B] hover:bg-[#FAF8F5]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <ToastMessage message={error} />
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                  Nhân viên thuộc chi nhánh
                </label>
                <select
                  value={managerUserId}
                  onChange={(event) => setManagerUserId(event.target.value)}
                  className="h-11 w-full cursor-pointer rounded-xl border border-[#E9E1D8] bg-white px-4 text-sm outline-none focus:border-[#C9894B]"
                >
                  <option value="">Chọn nhân viên</option>
                  {branchEmployees
                    .filter(
                      (user) =>
                        user.branch?.id === managerBranch.id && user.isActive,
                    )
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName || user.email} -{" "}
                        {user.role.name === "BRANCH_MANAGER"
                          ? "Nhân viên trưởng"
                          : "Nhân viên"}
                      </option>
                    ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-[#8A817B]">
                  Khi phân công, tài khoản sẽ được đổi thành Nhân viên trưởng và
                  có quyền vào trang quản lý nhân viên. Nếu thay trưởng cũ,
                  người cũ sẽ trở lại vai trò Nhân viên.
                </p>
              </div>

              <div className="flex justify-between gap-3 border-t border-[#F0E8E0] pt-5">
                <div>
                  {managerBranch.manager && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleRemoveManager()}
                      className="cursor-pointer rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      Gỡ quyền trưởng
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setManagerBranch(null)}
                    className="cursor-pointer rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] hover:bg-[#FAF8F5]"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={saving || !managerUserId}
                    onClick={() => void handleSaveManager()}
                    className="cursor-pointer rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#382118] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Đang lưu..." : "Lưu phân công"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
