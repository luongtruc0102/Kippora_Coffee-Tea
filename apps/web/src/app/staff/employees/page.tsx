"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  LockKeyhole,
  LogIn,
  LogOut,
  Search,
  UnlockKeyhole,
  UserPlus,
  Users,
} from "lucide-react";

import StaffEmployeeFormModal from "@/components/staff/staff-employee-form-modal";
import LeaveRequestManager from "@/components/staff/leave-request-manager";
import { useAppToast } from "@/components/ui/app-toast-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  checkInBranchStaff,
  checkOutBranchStaff,
  getBranchStaff,
  getTodayBranchAttendance,
  updateBranchStaffStatus,
} from "@/services/user.service";
import type { BranchStaff, StaffAttendance } from "@/types/user";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWorkedSeconds(seconds: number) {
  const normalizedSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const remainder = normalizedSeconds % 60;
  return `${hours} giờ ${minutes} phút ${remainder} giây`;
}

function getAttendanceSeconds(
  attendance: StaffAttendance,
  currentTime = Date.now(),
) {
  const endTime = attendance.clockOut
    ? new Date(attendance.clockOut).getTime()
    : currentTime;

  return Math.max(
    0,
    Math.floor((endTime - new Date(attendance.clockIn).getTime()) / 1000),
  );
}

function formatDuration(attendance: StaffAttendance, currentTime: number) {
  return formatWorkedSeconds(getAttendanceSeconds(attendance, currentTime));
}

export default function StaffEmployeesPage() {
  const router = useRouter();
  const { showToast } = useAppToast();
  const [staff, setStaff] = useState<BranchStaff[]>([]);
  const [attendances, setAttendances] = useState<StaffAttendance[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    try {
      const user = storedUser
        ? (JSON.parse(storedUser) as { role: string })
        : null;
      if (user?.role !== "BRANCH_MANAGER") router.replace("/staff/orders");
    } catch {
      router.replace("/login");
    }
  }, [router]);

  // Cập nhật thời lượng ca đang mở mỗi giây; ca đã chốt giữ nguyên clockOut.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const loadData = useCallback(
    async (query = "", signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;

      try {
        setLoading(true);
        const [staffData, attendanceData] = await Promise.all([
          getBranchStaff(accessToken, query, signal),
          getTodayBranchAttendance(accessToken, signal),
        ]);
        setStaff(staffData);
        setAttendances(attendanceData);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        showToast(
          error instanceof Error ? error.message : "Không thể tải nhân viên",
          "error",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadData(debouncedSearch, controller.signal);
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [debouncedSearch, loadData]);

  // Tự đồng bộ ca đang mở để nút của trưởng đổi sang "Kết thúc ca"
  // sau khi nhân viên tự điểm danh ở giao diện user, không cần tải lại trang.
  useEffect(() => {
    let active = true;

    const refreshAttendances = async () => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken || document.visibilityState === "hidden") return;

      try {
        const attendanceData = await getTodayBranchAttendance(accessToken);
        if (active) setAttendances(attendanceData);
      } catch {
        // Lần tải chính đã hiển thị lỗi; polling nền không tạo toast lặp lại.
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshAttendances();
    }, 10_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshAttendances();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const latestAttendance = useMemo(() => {
    const result = new Map<number, StaffAttendance>();
    for (const attendance of attendances) {
      if (!result.has(attendance.employeeId)) {
        result.set(attendance.employeeId, attendance);
      }
    }
    return result;
  }, [attendances]);

  const activeCount = staff.filter((item) => item.isActive).length;
  const workingCount = attendances.filter((item) => !item.clockOut).length;

  function saveAttendance(updated: StaffAttendance) {
    setAttendances((current) => [
      updated,
      ...current.filter((item) => item.id !== updated.id),
    ]);
  }

  async function handleAttendance(item: BranchStaff) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    const current = latestAttendance.get(item.id);

    try {
      setUpdatingId(item.id);
      const updated =
        current && !current.clockOut
          ? await checkOutBranchStaff(accessToken, item.id)
          : await checkInBranchStaff(accessToken, item.id);
      saveAttendance(updated);

      // Khi chốt ca, cộng thời lượng vừa hoàn thành vào tổng ngay trên bảng.
      if (updated.clockOut) {
        const workedSeconds = getAttendanceSeconds(updated);

        setStaff((currentStaff) =>
          currentStaff.map((employee) =>
            employee.id === item.id
              ? {
                  ...employee,
                  totalWorkedSeconds:
                    employee.totalWorkedSeconds + workedSeconds,
                }
              : employee,
          ),
        );
      }

      showToast(
        updated.clockOut
          ? `Đã kết thúc ca của ${item.fullName || item.email}`
          : `Đã bắt đầu ca cho ${item.fullName || item.email}`,
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể chấm công",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleToggleStatus(item: BranchStaff) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;

    try {
      setUpdatingId(item.id);
      const updated = await updateBranchStaffStatus(
        accessToken,
        item.id,
        !item.isActive,
      );
      setStaff((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...updated,
                totalWorkedSeconds: entry.totalWorkedSeconds,
              }
            : entry,
        ),
      );
      showToast(
        updated.isActive ? "Đã mở tài khoản nhân viên" : "Đã khóa nhân viên",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể đổi trạng thái",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9894B]">
            Vận hành chi nhánh
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1F1B18]">
            Nhân viên & chấm công
          </h1>
          <p className="mt-1 text-[#78866B]">
            Theo dõi nhân viên đang hoạt động và thời gian làm việc trong ngày.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-3 font-semibold text-white hover:bg-[#382118]"
        >
          <UserPlus size={19} /> Thêm nhân viên
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Tổng nhân viên", value: staff.length, icon: Users },
          { label: "Đang hoạt động", value: activeCount, icon: UnlockKeyhole },
          { label: "Đang trong ca", value: workingCount, icon: Clock3 },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm text-[#78866B]">{label}</p>
              <p className="mt-2 text-3xl font-bold text-[#2A211D]">{value}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#C9894B]">
              <Icon size={22} />
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="relative">
          <Search
            size={19}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A817B]"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên, email hoặc số điện thoại..."
            className="h-12 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-11 pr-4 outline-none focus:border-[#C9894B]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-sm text-[#78866B]">Đang tải nhân viên...</p>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-[#78866B]">
            Chưa có nhân viên trong chi nhánh.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed">
              <colgroup>
                <col className="w-[23%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[15%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="border-b border-[#E9E1D8] bg-[#FAF8F5] text-left text-xs uppercase tracking-wide text-[#78866B]">
                <tr>
                  <th className="px-6 py-4">Nhân viên</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4">Vào ca</th>
                  <th className="px-6 py-4">Ra ca</th>
                  <th className="px-6 py-4">Thời gian làm</th>
                  <th className="px-6 py-4">Tổng thời gian làm</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((item) => {
                  const attendance = latestAttendance.get(item.id);
                  const inShift = Boolean(attendance && !attendance.clockOut);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[#F0E8E0] last:border-0 hover:bg-[#FCFAF7]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {item.avatarUrl ? (
                            <Image
                              unoptimized
                              src={item.avatarUrl}
                              alt={item.fullName || "Nhân viên"}
                              width={42}
                              height={42}
                              className="h-11 w-11 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F3E9DE] font-bold text-[#4A2C20]">
                              {(item.fullName || item.email)
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          )}
                          <div>
                            <p className="font-semibold text-[#2A211D]">
                              {item.fullName || "Chưa cập nhật tên"}
                            </p>
                            <p className="mt-1 text-xs text-[#8A817B]">
                              {item.email} · {item.phone || "Chưa có SĐT"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {item.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#5E5650]">
                        {attendance ? formatTime(attendance.clockIn) : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#5E5650]">
                        {attendance?.clockOut
                          ? formatTime(attendance.clockOut)
                          : inShift
                            ? "Đang trong ca"
                            : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#4A2C20]">
                        {attendance
                          ? formatDuration(attendance, currentTime)
                          : "Chưa chấm công"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#9F642F]">
                        {formatWorkedSeconds(item.totalWorkedSeconds)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={!item.isActive || updatingId === item.id}
                            onClick={() => void handleAttendance(item)}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                              inShift
                                ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {inShift ? (
                              <LogOut size={16} />
                            ) : (
                              <LogIn size={16} />
                            )}
                            {inShift ? "Kết thúc ca" : "Bắt đầu ca"}
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === item.id || inShift}
                            onClick={() => void handleToggleStatus(item)}
                            title={
                              inShift
                                ? "Cần kết thúc ca trước khi khóa"
                                : item.isActive
                                  ? "Khóa nhân viên"
                                  : "Mở tài khoản"
                            }
                            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-[#F7F2EC] text-[#6B625C] hover:bg-[#EEE3D8] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {item.isActive ? (
                              <LockKeyhole size={17} />
                            ) : (
                              <UnlockKeyhole size={17} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LeaveRequestManager />

      <StaffEmployeeFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(created) => setStaff((current) => [created, ...current])}
      />
    </div>
  );
}
