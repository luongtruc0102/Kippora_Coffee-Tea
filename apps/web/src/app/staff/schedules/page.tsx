"use client";

import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import StaffShiftModal, {
  type StaffShiftDraft,
} from "@/components/staff/staff-shift-modal";
import AttendanceReportPanel from "@/components/staff/attendance-report-panel";
import WeeklyScheduleBoard from "@/components/staff/weekly-schedule-board";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  createStaffShift,
  deleteStaffShift,
  getStaffScheduleWeek,
  updateStaffShift,
} from "@/services/staff-schedule.service";
import type {
  ScheduleEmployee,
  StaffScheduleWeek,
  StaffShift,
} from "@/types/staff-schedule";
import {
  buildShiftIso,
  formatScheduleTime,
  getCurrentWeekStart,
  getVietnamDateKey,
  getWeekDates,
  shiftWeek,
} from "@/utils/staff-schedule.util";

function formatWeekRange(weekStart: string) {
  const dates = getWeekDates(weekStart);
  const format = (value: string) =>
    new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(`${value}T12:00:00Z`));
  return `${format(dates[0])} – ${format(dates[6])}`;
}

export default function StaffSchedulesPage() {
  const { showToast } = useAppToast();
  const [weekStart, setWeekStart] = useState(() => getCurrentWeekStart());
  const [data, setData] = useState<StaffScheduleWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState<StaffShiftDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StaffShift | null>(null);

  const loadWeek = useCallback(
    async (week: string, signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        setData(
          await getStaffScheduleWeek(accessToken, week, undefined, signal),
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        showToast(
          error instanceof Error ? error.message : "Không thể tải lịch làm",
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
    const timeoutId = window.setTimeout(
      () => void loadWeek(weekStart, controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadWeek, weekStart]);

  function openCreate(
    employee: ScheduleEmployee,
    date: string,
    startTime: string,
    endTime: string,
  ) {
    setDraft({ employeeId: employee.id, date, startTime, endTime, note: "" });
  }

  function openEdit(shift: StaffShift) {
    setDraft({
      shiftId: shift.id,
      employeeId: shift.employeeId,
      date: getVietnamDateKey(shift.startAt),
      startTime: formatScheduleTime(shift.startAt),
      endTime: formatScheduleTime(shift.endAt),
      note: shift.note || "",
    });
  }

  async function saveShift(value: StaffShiftDraft) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    const startAt = buildShiftIso(value.date, value.startTime);
    const endAt = buildShiftIso(
      value.date,
      value.endTime,
      value.endTime <= value.startTime,
    );
    try {
      setSaving(true);
      if (value.shiftId) {
        await updateStaffShift(accessToken, value.shiftId, {
          startAt,
          endAt,
          note: value.note,
        });
        showToast("Đã cập nhật ca làm", "success");
      } else {
        await createStaffShift(accessToken, {
          employeeId: value.employeeId,
          startAt,
          endAt,
          note: value.note,
        });
        showToast("Đã xếp ca cho nhân viên", "success");
      }
      setDraft(null);
      await loadWeek(weekStart);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể lưu ca làm",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeShift(shift: StaffShift) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setDeleting(true);
      await deleteStaffShift(accessToken, shift.id);
      showToast("Đã xóa ca làm", "success");
      setPendingDelete(null);
      await loadWeek(weekStart);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể xóa ca làm",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9894B]">
            Khu vực nhân viên trưởng
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1F1B18]">
            Lịch làm nhân viên
          </h1>
          <p className="mt-1 text-sm text-[#78866B]">
            Kéo thả nhân viên vào lịch tuần của chi nhánh.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-[#E9E1D8] bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setWeekStart((value) => shiftWeek(value, -1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#F3E9DE]"
            title="Tuần trước"
          >
            <ChevronLeft size={19} />
          </button>
          <div className="min-w-44 px-2 text-center">
            <p className="text-xs text-[#8A817B]">Tuần đang xem</p>
            <p className="text-sm font-bold text-[#4A2C20]">
              {formatWeekRange(weekStart)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWeekStart((value) => shiftWeek(value, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#F3E9DE]"
            title="Tuần sau"
          >
            <ChevronRight size={19} />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getCurrentWeekStart())}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#F3E9DE] px-3 text-sm font-semibold text-[#4A2C20]"
          >
            <RotateCcw size={16} /> Tuần này
          </button>
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E9E1D8] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#A45F2F]">
              <CalendarDays size={21} />
            </span>
            <div>
              <p className="font-bold text-[#2A211D]">
                {data.branch.code} · {data.branch.name}
              </p>
              <p className="text-xs text-[#78866B]">
                {data.employees.filter((item) => item.isActive).length} nhân
                viên đang hoạt động · {data.shifts.length} ca trong tuần
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            Điểm danh mở trước ca 5 phút
          </span>
        </div>
      )}

      {loading && !data ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-[#E9E1D8] bg-white">
          <LoaderCircle className="animate-spin text-[#C9894B]" />
        </div>
      ) : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <WeeklyScheduleBoard
            data={data}
            onCreate={openCreate}
            onEdit={openEdit}
            onDelete={setPendingDelete}
          />
        </div>
      ) : null}

      <AttendanceReportPanel allowEdit />

      {draft && data && (
        <StaffShiftModal
          key={`${draft.shiftId ?? "new"}-${draft.employeeId}-${draft.date}`}
          employees={data.employees.filter((employee) => employee.isActive)}
          initialValue={draft}
          saving={saving}
          onClose={() => setDraft(null)}
          onSave={(value) => void saveShift(value)}
        />
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting)
              setPendingDelete(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-shift-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#EEE5DD] px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <AlertTriangle size={21} />
                </span>
                <div>
                  <h2
                    id="delete-shift-title"
                    className="text-lg font-bold text-[#2A211D]"
                  >
                    Xác nhận xóa ca
                  </h2>
                  <p className="mt-0.5 text-sm text-[#8A817B]">
                    Ca làm sẽ bị xóa khỏi lịch tuần.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8A817B] hover:bg-[#F7F2EC] disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4">
                <p className="font-bold text-[#2A211D]">
                  {pendingDelete.employee.fullName ||
                    pendingDelete.employee.email}
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#A45F2F]">
                  <CalendarDays size={15} />
                  {new Intl.DateTimeFormat("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }).format(new Date(pendingDelete.startAt))}
                </p>
                <p className="mt-1 pl-[23px] text-sm text-[#6F655E]">
                  {formatScheduleTime(pendingDelete.startAt)} –{" "}
                  {formatScheduleTime(pendingDelete.endAt)}
                </p>
              </div>
              <p className="mt-3 text-sm text-[#8A817B]">
                Anh có chắc muốn xóa ca làm này không?
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="rounded-xl border border-[#D9CABE] bg-white px-5 py-2.5 text-sm font-semibold text-[#5E5650] hover:bg-[#F7F2EC] disabled:opacity-50"
              >
                Giữ lại
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void removeShift(pendingDelete)}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                {deleting ? "Đang xóa..." : "Xóa ca làm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
