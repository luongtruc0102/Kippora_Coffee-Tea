"use client";

import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  History,
  LoaderCircle,
  PencilLine,
  RotateCcw,
  Send,
  ShieldCheck,
  Timer,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import AttendanceAdjustmentModal from "@/components/staff/attendance-adjustment-modal";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  getAttendancePeriod,
  getAttendanceReport,
  reopenAttendancePeriod,
  reviewAttendancePeriod,
  submitAttendancePeriod,
  updateStaffAttendance,
} from "@/services/staff-schedule.service";
import type {
  AttendancePeriod,
  AttendanceReport,
  AttendanceReportRow,
  AttendanceReportStatus,
  UpdateStaffAttendanceInput,
} from "@/types/staff-schedule";
import {
  getCurrentWeekStart,
  getVietnamDateKey,
  getWeekDates,
} from "@/utils/staff-schedule.util";
import {
  attendanceStatusLabels,
  formatAttendanceDate,
  formatAttendanceDuration,
  formatAttendanceTime,
} from "@/utils/attendance-report.util";
import { downloadAttendanceReportExcel } from "@/utils/attendance-report-excel";

type Props = {
  branchId?: number | null;
  allowEdit?: boolean;
};

type Preset = "WEEK" | "MONTH" | "CUSTOM";
type View = "SUMMARY" | "DETAIL";
type PeriodAction = "SUBMIT" | "APPROVE" | "RETURN" | "REOPEN";

const statusStyles: Record<AttendanceReportStatus, string> = {
  UPCOMING: "bg-slate-100 text-slate-600",
  ABSENT: "bg-red-50 text-red-600",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  LATE_IN_PROGRESS: "bg-amber-50 text-amber-700",
  ON_TIME: "bg-emerald-50 text-emerald-700",
  LATE: "bg-amber-50 text-amber-700",
  EARLY_LEAVE: "bg-orange-50 text-orange-700",
  LATE_AND_EARLY: "bg-rose-50 text-rose-700",
  UNSCHEDULED: "bg-violet-50 text-violet-700",
  EXCUSED_LEAVE: "bg-cyan-50 text-cyan-700",
  LEAVE_PENDING: "bg-yellow-50 text-yellow-700",
  LEAVE_NEEDS_INFO: "bg-fuchsia-50 text-fuchsia-700",
};

function currentWeekRange() {
  const weekStart = getCurrentWeekStart();
  const dates = getWeekDates(weekStart);
  return { startDate: dates[0], endDate: dates[6] };
}

function currentMonthRange() {
  const today = getVietnamDateKey(new Date());
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

function fullMonthForRange(startDate: string, endDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const month = startDate.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return startDate === `${month}-01` &&
    endDate === `${month}-${String(lastDay).padStart(2, "0")}`
    ? month
    : null;
}

const periodStatusLabels = {
  DRAFT: "Chưa gửi",
  PENDING: "Chờ Admin duyệt",
  APPROVED: "Đã duyệt",
  RETURNED: "Cần chỉnh sửa",
} as const;

const periodActionLabels = {
  SUBMITTED: "Đã gửi đối soát",
  APPROVED: "Admin đã duyệt",
  RETURNED: "Admin trả lại",
  REOPENED: "Admin mở lại",
} as const;

export default function AttendanceReportPanel({
  branchId,
  allowEdit = false,
}: Props) {
  const { showToast } = useAppToast();
  const initialRange = currentWeekRange();
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [preset, setPreset] = useState<Preset>("WEEK");
  const [view, setView] = useState<View>("SUMMARY");
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<AttendanceReportRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [attendancePeriod, setAttendancePeriod] =
    useState<AttendancePeriod | null>(null);
  const [periodAction, setPeriodAction] = useState<PeriodAction | null>(null);
  const [periodNote, setPeriodNote] = useState("");
  const [periodSaving, setPeriodSaving] = useState(false);
  const reviewMonth = fullMonthForRange(startDate, endDate);

  const loadReport = useCallback(
    async (signal?: AbortSignal) => {
      if (branchId === null || !startDate || !endDate || startDate > endDate) {
        setLoading(false);
        return;
      }
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        const [data, period] = await Promise.all([
          getAttendanceReport(
            accessToken,
            startDate,
            endDate,
            branchId ?? undefined,
            signal,
          ),
          reviewMonth
            ? getAttendancePeriod(
                accessToken,
                reviewMonth,
                branchId ?? undefined,
                signal,
              )
            : Promise.resolve(null),
        ]);
        setReport(data);
        setAttendancePeriod(period);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        showToast(
          error instanceof Error ? error.message : "Không thể tải bảng công",
          "error",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [branchId, endDate, reviewMonth, showToast, startDate],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => void loadReport(controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadReport]);

  function applyPreset(nextPreset: Exclude<Preset, "CUSTOM">) {
    const range =
      nextPreset === "WEEK" ? currentWeekRange() : currentMonthRange();
    setPreset(nextPreset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  async function exportExcel() {
    if (!report) return;
    try {
      setExporting(true);
      await downloadAttendanceReportExcel(report);
      showToast("Đã tải file Excel bảng công", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể xuất bảng công",
        "error",
      );
    } finally {
      setExporting(false);
    }
  }

  async function saveAdjustment(input: UpdateStaffAttendanceInput) {
    if (!editing?.attendanceId) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      await updateStaffAttendance(accessToken, editing.attendanceId, input);
      setEditing(null);
      showToast("Đã điều chỉnh chấm công và tính lại thời gian làm", "success");
      await loadReport();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể điều chỉnh chấm công",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function runPeriodAction() {
    if (!periodAction || !reviewMonth) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    if (
      (periodAction === "RETURN" || periodAction === "REOPEN") &&
      periodNote.trim().length < 3
    ) {
      showToast("Anh cần nhập lý do ít nhất 3 ký tự", "error");
      return;
    }
    if (periodAction !== "SUBMIT" && !attendancePeriod?.id) return;
    try {
      setPeriodSaving(true);
      const updated =
        periodAction === "SUBMIT"
          ? await submitAttendancePeriod(accessToken, reviewMonth)
          : periodAction === "REOPEN"
            ? await reopenAttendancePeriod(
                accessToken,
                attendancePeriod!.id!,
                periodNote.trim(),
              )
            : await reviewAttendancePeriod(accessToken, attendancePeriod!.id!, {
                action: periodAction === "APPROVE" ? "APPROVE" : "RETURN",
                ...(periodNote.trim() ? { note: periodNote.trim() } : {}),
              });
      setAttendancePeriod(updated);
      setPeriodAction(null);
      setPeriodNote("");
      showToast(
        periodAction === "SUBMIT"
          ? "Đã gửi bảng công cho Admin duyệt"
          : periodAction === "APPROVE"
            ? "Đã duyệt và khóa bảng công"
            : periodAction === "RETURN"
              ? "Đã trả bảng công cho trưởng chi nhánh chỉnh sửa"
              : "Đã mở lại bảng công",
        "success",
      );
      await loadReport();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể xử lý bảng công",
        "error",
      );
    } finally {
      setPeriodSaving(false);
    }
  }

  const cards = report
    ? [
        {
          label: "Ca được xếp",
          value: report.summary.scheduledShifts,
          icon: CalendarDays,
          tone: "text-[#A45F2F] bg-[#FFF4E8]",
        },
        {
          label: "Đúng giờ",
          value: report.summary.onTimeShifts,
          icon: UserCheck,
          tone: "text-emerald-700 bg-emerald-50",
        },
        {
          label: "Đi trễ",
          value: report.summary.lateShifts,
          icon: Clock3,
          tone: "text-amber-700 bg-amber-50",
        },
        {
          label: "Về sớm",
          value: report.summary.earlyLeaveShifts,
          icon: Timer,
          tone: "text-orange-700 bg-orange-50",
        },
        {
          label: "Vắng mặt",
          value: report.summary.absentShifts,
          icon: UserX,
          tone: "text-red-600 bg-red-50",
        },
        {
          label: "Nghỉ có phép",
          value: report.summary.excusedLeaveShifts,
          icon: CalendarCheck2,
          tone: "text-cyan-700 bg-cyan-50",
        },
        {
          label: "Tổng giờ làm",
          value: formatAttendanceDuration(report.summary.workedSeconds),
          icon: CalendarCheck2,
          tone: "text-blue-700 bg-blue-50",
        },
        {
          label: "Tổng tăng ca",
          value: formatAttendanceDuration(report.summary.overtimeSeconds),
          icon: Clock3,
          tone: "text-violet-700 bg-violet-50",
        },
      ]
    : [];

  return (
    <section className="space-y-4 rounded-3xl border border-[#E9E1D8] bg-[#FBF9F6] p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#2A211D]">
            Bảng công nhân viên
          </h2>
          <p className="mt-1 text-sm text-[#78866B]">
            Tổng hợp theo lịch làm và thời gian chấm công thực tế.
          </p>
        </div>
        <button
          type="button"
          disabled={!report?.rows.length || exporting}
          onClick={() => void exportExcel()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white hover:bg-[#382118] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <Download size={17} />
          )}
          {exporting ? "Đang xuất..." : "Xuất Excel"}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E9E1D8] bg-white p-3">
        <div className="flex rounded-xl bg-[#F5F0EA] p-1">
          {(["WEEK", "MONTH"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => applyPreset(item)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                preset === item
                  ? "bg-[#4A2C20] text-white shadow-sm"
                  : "text-[#6F655E]"
              }`}
            >
              {item === "WEEK" ? "Tuần này" : "Tháng này"}
            </button>
          ))}
        </div>
        <label className="space-y-1 text-xs font-semibold text-[#78866B]">
          <span className="block">Từ ngày</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => {
              setPreset("CUSTOM");
              setStartDate(event.target.value);
            }}
            className="h-10 rounded-xl border border-[#DED5CC] px-3 text-sm font-normal text-[#2A211D] outline-none focus:border-[#C9894B]"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-[#78866B]">
          <span className="block">Đến ngày</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => {
              setPreset("CUSTOM");
              setEndDate(event.target.value);
            }}
            className="h-10 rounded-xl border border-[#DED5CC] px-3 text-sm font-normal text-[#2A211D] outline-none focus:border-[#C9894B]"
          />
        </label>
        {startDate > endDate && (
          <p className="pb-2 text-xs font-medium text-red-600">
            Ngày bắt đầu phải trước ngày kết thúc.
          </p>
        )}
        {report && (
          <p className="ml-auto pb-2 text-xs text-[#8A817B]">
            {report.branch.code} · {report.branch.name}
          </p>
        )}
      </div>

      {!reviewMonth ? (
        <div className="rounded-2xl border border-dashed border-[#DCCFC3] bg-white px-4 py-3 text-sm text-[#786F68]">
          Chọn <strong>Tháng này</strong> hoặc lọc trọn một tháng để gửi và
          duyệt bảng công.
        </div>
      ) : attendancePeriod ? (
        <div className="rounded-2xl border border-[#E6D9CC] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF3E6] text-[#B96C34]">
                <ShieldCheck size={20} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[#2A211D]">
                    Đối soát bảng công tháng {reviewMonth.slice(5, 7)}/
                    {reviewMonth.slice(0, 4)}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      attendancePeriod.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-700"
                        : attendancePeriod.status === "PENDING"
                          ? "bg-amber-50 text-amber-700"
                          : attendancePeriod.status === "RETURNED"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {periodStatusLabels[attendancePeriod.status]}
                    {attendancePeriod.revision > 0
                      ? ` · Lần ${attendancePeriod.revision}`
                      : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#786F68]">
                  {attendancePeriod.status === "DRAFT"
                    ? "Trưởng chi nhánh kiểm tra các ca bất thường rồi gửi Admin."
                    : attendancePeriod.status === "PENDING"
                      ? "Dữ liệu đang tạm khóa trong lúc chờ Admin duyệt."
                      : attendancePeriod.status === "APPROVED"
                        ? "Dữ liệu đã khóa và đủ điều kiện dùng để chốt lương."
                        : attendancePeriod.reviewNote ||
                          "Hãy chỉnh dữ liệu theo phản hồi rồi gửi lại."}
                </p>
                {attendancePeriod.reviewNote &&
                  attendancePeriod.status !== "RETURNED" && (
                    <p className="mt-1 text-xs text-[#9A5A32]">
                      Ghi chú Admin: {attendancePeriod.reviewNote}
                    </p>
                  )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {allowEdit &&
                (attendancePeriod.status === "DRAFT" ||
                  attendancePeriod.status === "RETURNED") && (
                  <button
                    type="button"
                    disabled={periodSaving || !attendancePeriod.canSubmit}
                    title={
                      !attendancePeriod.canSubmit
                        ? "Chỉ gửi sau khi tháng đã kết thúc"
                        : "Gửi bảng công cho Admin"
                    }
                    onClick={() => setPeriodAction("SUBMIT")}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Send size={16} /> Gửi Admin duyệt
                  </button>
                )}
              {!allowEdit && attendancePeriod.status === "PENDING" && (
                <>
                  <button
                    type="button"
                    disabled={periodSaving}
                    onClick={() => setPeriodAction("RETURN")}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700"
                  >
                    <RotateCcw size={16} /> Trả lại
                  </button>
                  <button
                    type="button"
                    disabled={periodSaving}
                    onClick={() => setPeriodAction("APPROVE")}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
                  >
                    <CheckCircle2 size={16} /> Duyệt bảng công
                  </button>
                </>
              )}
              {!allowEdit && attendancePeriod.status === "APPROVED" && (
                <button
                  type="button"
                  disabled={periodSaving}
                  onClick={() => setPeriodAction("REOPEN")}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9CABE] px-4 text-sm font-semibold text-[#7A4A2B]"
                >
                  <RotateCcw size={16} /> Mở lại
                </button>
              )}
            </div>
          </div>

          {attendancePeriod.events.length > 0 && (
            <details className="mt-3 border-t border-[#F0E7DE] pt-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[#786F68]">
                <History size={14} /> Lịch sử đối soát
              </summary>
              <div className="mt-2 space-y-2">
                {attendancePeriod.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-wrap justify-between gap-2 text-xs text-[#786F68]"
                  >
                    <span>
                      <strong>{periodActionLabels[event.action]}</strong>
                      {event.actor?.fullName || event.actor?.email
                        ? ` · ${event.actor.fullName || event.actor.email}`
                        : ""}
                      {event.note ? ` · ${event.note}` : ""}
                    </span>
                    <time>
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Asia/Ho_Chi_Minh",
                      }).format(new Date(event.createdAt))}
                    </time>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : null}

      {loading && !report ? (
        <div className="flex min-h-52 items-center justify-center rounded-2xl border border-[#E9E1D8] bg-white">
          <LoaderCircle className="animate-spin text-[#C9894B]" />
        </div>
      ) : report ? (
        <div className={loading ? "space-y-4 opacity-60" : "space-y-4"}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ label, value, icon: Icon, tone }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-2xl border border-[#E9E1D8] bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="text-xs text-[#78866B]">{label}</p>
                  <p className="mt-1 truncate text-lg font-bold text-[#2A211D]">
                    {value}
                  </p>
                </div>
                <span
                  className={`ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
                >
                  <Icon size={18} />
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-b border-[#E9E1D8]">
            {(["SUMMARY", "DETAIL"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={`border-b-2 px-3 py-2.5 text-sm font-semibold ${
                  view === item
                    ? "border-[#C9894B] text-[#4A2C20]"
                    : "border-transparent text-[#8A817B]"
                }`}
              >
                {item === "SUMMARY" ? "Tổng hợp nhân viên" : "Chi tiết từng ca"}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white">
            {view === "SUMMARY" ? (
              report.employees.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[940px]">
                    <thead className="bg-[#FAF8F5] text-left text-xs uppercase tracking-wide text-[#78866B]">
                      <tr>
                        <th className="px-5 py-4">Nhân viên</th>
                        <th className="px-4 py-4 text-center">Ca được xếp</th>
                        <th className="px-4 py-4 text-center">Đã làm</th>
                        <th className="px-4 py-4 text-center">Đi trễ</th>
                        <th className="px-4 py-4 text-center">Về sớm</th>
                        <th className="px-4 py-4 text-center">Vắng</th>
                        <th className="px-4 py-4 text-center">Nghỉ phép</th>
                        <th className="px-4 py-4">Tổng giờ</th>
                        <th className="px-4 py-4">Tăng ca</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.employees.map((item) => (
                        <tr
                          key={item.employee.id}
                          className="border-t border-[#F0E8E0]"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold text-[#2A211D]">
                              {item.employee.fullName || "Chưa cập nhật tên"}
                            </p>
                            <p className="mt-0.5 text-xs text-[#8A817B]">
                              {item.employee.email}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-center font-semibold">
                            {item.scheduledShifts}
                          </td>
                          <td className="px-4 py-4 text-center font-semibold text-emerald-700">
                            {item.completedShifts}
                          </td>
                          <td className="px-4 py-4 text-center font-semibold text-amber-700">
                            {item.lateShifts}
                          </td>
                          <td className="px-4 py-4 text-center font-semibold text-orange-700">
                            {item.earlyLeaveShifts}
                          </td>
                          <td className="px-4 py-4 text-center font-semibold text-red-600">
                            {item.absentShifts}
                          </td>
                          <td className="px-4 py-4 text-center font-semibold text-cyan-700">
                            {item.excusedLeaveShifts}
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-[#4A2C20]">
                            {formatAttendanceDuration(item.workedSeconds)}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#8A817B]">
                            {formatAttendanceDuration(item.overtimeSeconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-10 text-center text-sm text-[#8A817B]">
                  Chưa có lịch hoặc dữ liệu chấm công trong khoảng ngày này.
                </p>
              )
            ) : report.rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px]">
                  <thead className="bg-[#FAF8F5] text-left text-xs uppercase tracking-wide text-[#78866B]">
                    <tr>
                      <th className="px-4 py-4">Nhân viên</th>
                      <th className="px-4 py-4">Ngày</th>
                      <th className="px-4 py-4">Ca dự kiến</th>
                      <th className="px-4 py-4">Thực tế</th>
                      <th className="px-4 py-4">Kết quả</th>
                      <th className="px-4 py-4">Thời gian làm</th>
                      <th className="px-4 py-4">Điều chỉnh</th>
                      {allowEdit && (
                        <th className="px-4 py-4 text-right">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => {
                      const baseDate = row.scheduledStart || row.clockIn;
                      return (
                        <tr
                          key={row.key}
                          className="border-t border-[#F0E8E0] align-top"
                        >
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[#2A211D]">
                              {row.employee.fullName || "Chưa cập nhật tên"}
                            </p>
                            <p className="mt-0.5 text-xs text-[#8A817B]">
                              {row.employee.email}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-[#5E5650]">
                            {baseDate ? formatAttendanceDate(baseDate) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-[#5E5650]">
                            {row.scheduledStart
                              ? `${formatAttendanceTime(row.scheduledStart)} – ${formatAttendanceTime(row.scheduledEnd)}`
                              : "Ngoài lịch"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-[#5E5650]">
                            {row.clockIn
                              ? `${formatAttendanceTime(row.clockIn)} – ${row.clockOut ? formatAttendanceTime(row.clockOut) : "Đang làm"}`
                              : "Chưa chấm công"}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[row.status]}`}
                            >
                              {attendanceStatusLabels[row.status]}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-[#4A2C20]">
                            {row.attendanceId
                              ? formatAttendanceDuration(row.workedSeconds)
                              : "—"}
                            {row.overtimeSeconds > 0 && (
                              <p className="mt-1 text-xs font-medium text-blue-700">
                                +{formatAttendanceDuration(row.overtimeSeconds)}{" "}
                                tăng ca
                              </p>
                            )}
                          </td>
                          <td className="max-w-56 px-4 py-4 text-xs text-[#8A817B]">
                            {row.leaveRequest ? (
                              <>
                                <p className="font-medium text-[#5E5650]">
                                  {row.leaveRequest.reason}
                                </p>
                                {row.leaveRequest.reviewNote && (
                                  <p className="mt-1">
                                    Phản hồi: {row.leaveRequest.reviewNote}
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                {row.adjustmentReason && (
                                  <>
                                    <p className="font-medium text-[#5E5650]">
                                      {row.adjustmentReason}
                                    </p>
                                    <p className="mt-1">
                                      Bởi{" "}
                                      {row.updatedBy?.fullName ||
                                        row.updatedBy?.email ||
                                        "người quản lý"}
                                    </p>
                                  </>
                                )}
                                {row.autoClockIn && (
                                  <p className="mt-1 font-medium text-blue-700">
                                    Tự bắt đầu từ ca liên tiếp
                                  </p>
                                )}
                                {row.autoClockOut && (
                                  <p className="mt-1 font-medium text-emerald-700">
                                    Tự kết thúc đúng lịch
                                  </p>
                                )}
                                {!row.adjustmentReason &&
                                  !row.autoClockIn &&
                                  !row.autoClockOut &&
                                  "—"}
                              </>
                            )}
                          </td>
                          {allowEdit && (
                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                disabled={
                                  !row.attendanceId ||
                                  !row.clockOut ||
                                  Boolean(attendancePeriod?.locked)
                                }
                                title={
                                  attendancePeriod?.locked
                                    ? "Bảng công đang bị khóa"
                                    : row.clockOut
                                      ? "Điều chỉnh chấm công"
                                      : "Cần kết thúc ca trước khi điều chỉnh"
                                }
                                onClick={() => setEditing(row)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#D9CABE] px-3 text-xs font-semibold text-[#A45F2F] hover:bg-[#FFF8F0] disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                <PencilLine size={14} /> Sửa công
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-10 text-center text-sm text-[#8A817B]">
                Chưa có chi tiết ca trong khoảng ngày này.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {editing && (
        <AttendanceAdjustmentModal
          key={`${editing.attendanceId}-${editing.updatedBy?.id ?? "new"}`}
          row={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={(input) => void saveAdjustment(input)}
        />
      )}

      {periodAction && attendancePeriod && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !periodSaving) {
              setPeriodAction(null);
              setPeriodNote("");
            }
          }}
        >
          <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E6D9CC] bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[#EEE5DD] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#2A211D]">
                  {periodAction === "SUBMIT"
                    ? "Gửi bảng công cho Admin?"
                    : periodAction === "APPROVE"
                      ? "Duyệt bảng công?"
                      : periodAction === "RETURN"
                        ? "Trả lại bảng công?"
                        : "Mở lại bảng công?"}
                </h2>
                <p className="mt-1 text-sm text-[#8A817B]">
                  Tháng {reviewMonth?.slice(5, 7)}/{reviewMonth?.slice(0, 4)} ·{" "}
                  {attendancePeriod.branch.code}
                </p>
              </div>
              <button
                type="button"
                disabled={periodSaving}
                onClick={() => {
                  setPeriodAction(null);
                  setPeriodNote("");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8A817B] hover:bg-[#F7F2EC]"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 px-6 py-5">
              <p className="rounded-2xl bg-[#FAF6F1] p-4 text-sm leading-6 text-[#665B53]">
                {periodAction === "SUBMIT"
                  ? "Sau khi gửi, lịch và dữ liệu chấm công của tháng này sẽ tạm khóa cho tới khi Admin duyệt hoặc trả lại."
                  : periodAction === "APPROVE"
                    ? "Sau khi duyệt, bảng công được khóa và có thể dùng để chốt bảng lương."
                    : "Bảng công sẽ mở lại để trưởng chi nhánh điều chỉnh và gửi lại."}
              </p>
              {periodAction !== "SUBMIT" && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#4A2C20]">
                    {periodAction === "APPROVE"
                      ? "Ghi chú (không bắt buộc)"
                      : "Lý do *"}
                  </span>
                  <textarea
                    value={periodNote}
                    maxLength={500}
                    onChange={(event) => setPeriodNote(event.target.value)}
                    placeholder={
                      periodAction === "APPROVE"
                        ? "Ghi chú cho trưởng chi nhánh..."
                        : "Nêu rõ dữ liệu cần kiểm tra hoặc điều chỉnh..."
                    }
                    className="min-h-28 w-full resize-none rounded-2xl border border-[#DED5CC] p-4 text-sm outline-none focus:border-[#C9894B]"
                  />
                </label>
              )}
            </div>
            <footer className="flex justify-end gap-3 border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
              <button
                type="button"
                disabled={periodSaving}
                onClick={() => {
                  setPeriodAction(null);
                  setPeriodNote("");
                }}
                className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={periodSaving}
                onClick={() => void runPeriodAction()}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                  periodAction === "RETURN" || periodAction === "REOPEN"
                    ? "bg-rose-600"
                    : periodAction === "APPROVE"
                      ? "bg-emerald-700"
                      : "bg-[#4A2C20]"
                }`}
              >
                {periodSaving ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : periodAction === "APPROVE" ? (
                  <CheckCircle2 size={16} />
                ) : periodAction === "SUBMIT" ? (
                  <Send size={16} />
                ) : (
                  <RotateCcw size={16} />
                )}
                Xác nhận
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
