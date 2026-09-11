"use client";

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  LoaderCircle,
  ReceiptText,
  TimerOff,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import { getMyPayroll } from "@/services/payroll.service";
import { getMyAttendanceReport } from "@/services/staff-schedule.service";
import type { PayrollReport } from "@/types/payroll";
import type { AttendanceReport } from "@/types/staff-schedule";
import {
  attendanceStatusLabels,
  formatAttendanceDate,
  formatAttendanceDuration,
  formatAttendanceTime,
} from "@/utils/attendance-report.util";

type View = "ATTENDANCE" | "PAYROLL";

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}`;
}

function money(value: number) {
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value)} đ`;
}

function payrollStatus(report: PayrollReport) {
  if (report.status === "PAID")
    return {
      label: "Đã thanh toán",
      note: report.paidAt
        ? `Thanh toán ngày ${new Intl.DateTimeFormat("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).format(new Date(report.paidAt))}`
        : "Kỳ lương đã được thanh toán.",
      className: "bg-emerald-50 text-emerald-700",
    };
  if (report.status === "FINALIZED")
    return {
      label: "Đã chốt · Chờ thanh toán",
      note: "Số liệu chính thức đã được Admin khóa.",
      className: "bg-blue-50 text-blue-700",
    };
  return {
    label: "Tạm tính",
    note: "Số liệu còn có thể thay đổi trước khi Admin chốt.",
    className: "bg-amber-50 text-amber-700",
  };
}

function rowStatusClass(status: string) {
  if (["ON_TIME", "EXCUSED_LEAVE"].includes(status))
    return "bg-emerald-50 text-emerald-700";
  if (["ABSENT", "LATE_AND_EARLY"].includes(status))
    return "bg-red-50 text-red-600";
  if (["LATE", "EARLY_LEAVE", "LATE_IN_PROGRESS"].includes(status))
    return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default function StaffPersonalRecordsPanel() {
  const { showToast } = useAppToast();
  const [month, setMonth] = useState(currentMonth);
  const [view, setView] = useState<View>("ATTENDANCE");
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [payroll, setPayroll] = useState<PayrollReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (signal?: AbortSignal) => {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setLoading(true);
      const [attendanceResult, payrollResult] = await Promise.all([
        getMyAttendanceReport(accessToken, month, signal),
        getMyPayroll(accessToken, month, signal),
      ]);
      setAttendance(attendanceResult);
      setPayroll(payrollResult);
      setError("");
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải bảng công và phiếu lương.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => void loadData(controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (window.location.hash === "#payroll") setView("PAYROLL");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const entry = payroll?.entries[0] ?? null;
  const status = payroll ? payrollStatus(payroll) : null;
  const attendanceCards = useMemo(
    () =>
      attendance
        ? [
            {
              label: "Ca được xếp",
              value: String(attendance.summary.scheduledShifts),
              icon: CalendarDays,
              color: "bg-orange-50 text-orange-700",
            },
            {
              label: "Đúng giờ",
              value: String(attendance.summary.onTimeShifts),
              icon: CheckCircle2,
              color: "bg-emerald-50 text-emerald-700",
            },
            {
              label: "Đi trễ",
              value: String(attendance.summary.lateShifts),
              icon: Clock3,
              color: "bg-amber-50 text-amber-700",
            },
            {
              label: "Về sớm",
              value: String(attendance.summary.earlyLeaveShifts),
              icon: TimerOff,
              color: "bg-orange-50 text-orange-600",
            },
            {
              label: "Vắng mặt",
              value: String(attendance.summary.absentShifts),
              icon: TriangleAlert,
              color: "bg-red-50 text-red-600",
            },
            {
              label: "Nghỉ có phép",
              value: String(attendance.summary.excusedLeaveShifts),
              icon: CalendarDays,
              color: "bg-cyan-50 text-cyan-700",
            },
            {
              label: "Tổng giờ làm",
              value: formatAttendanceDuration(attendance.summary.workedSeconds),
              icon: Clock3,
              color: "bg-blue-50 text-blue-700",
            },
            {
              label: "Tổng tăng ca",
              value: formatAttendanceDuration(attendance.summary.overtimeSeconds),
              icon: Clock3,
              color: "bg-violet-50 text-violet-700",
            },
          ]
        : [],
    [attendance],
  );

  async function downloadPayslip() {
    if (!payroll || !entry || payroll.status === "DRAFT") return;
    try {
      setDownloading(true);
      const { downloadPayrollPayslip } = await import(
        "@/utils/payroll-report-pdf"
      );
      await downloadPayrollPayslip(payroll, entry);
      showToast("Đã tải phiếu lương chính thức.", "success");
    } catch (downloadError) {
      showToast(
        downloadError instanceof Error
          ? downloadError.message
          : "Không thể tải phiếu lương.",
        "error",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section
      id="payroll"
      className="mt-8 scroll-mt-28 overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-[#EEE5DC] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C9894B]">
            Hồ sơ làm việc
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#2A211D]">
            Bảng công & phiếu lương của tôi
          </h2>
          <p className="mt-1 text-sm text-[#78866B]">
            Đối chiếu thời gian làm, các khoản cộng trừ và thu nhập theo tháng.
          </p>
        </div>
        <label className="text-sm font-medium text-[#6B625C]">
          Tháng xem
          <input
            type="month"
            value={month}
            onChange={(event) => {
              if (event.target.value) setMonth(event.target.value);
            }}
            className="mt-1 block rounded-xl border border-[#DCCFC3] bg-white px-3 py-2 text-[#2A211D] outline-none focus:border-[#C9894B]"
          />
        </label>
      </div>

      <div className="border-b border-[#EEE5DC] px-5 pt-3 sm:px-6">
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => setView("ATTENDANCE")}
            className={`border-b-2 px-1 py-3 text-sm font-semibold ${
              view === "ATTENDANCE"
                ? "border-[#C9894B] text-[#4A2C20]"
                : "border-transparent text-[#8A817B]"
            }`}
          >
            Bảng công
          </button>
          <button
            type="button"
            onClick={() => setView("PAYROLL")}
            className={`border-b-2 px-1 py-3 text-sm font-semibold ${
              view === "PAYROLL"
                ? "border-[#C9894B] text-[#4A2C20]"
                : "border-transparent text-[#8A817B]"
            }`}
          >
            Phiếu lương
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#78866B]">
          <LoaderCircle size={20} className="animate-spin" /> Đang tải dữ liệu...
        </div>
      ) : error ? (
        <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-600 sm:m-6">
          <TriangleAlert className="mx-auto" size={22} />
          <p className="mt-2">{error}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-3 rounded-xl bg-[#4A2C20] px-4 py-2 font-semibold text-white"
          >
            Tải lại
          </button>
        </div>
      ) : view === "ATTENDANCE" && attendance ? (
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {attendanceCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#EEE5DC] p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-[#78866B]">{card.label}</p>
                    <p className="mt-1 truncate font-bold text-[#2A211D]">
                      {card.value}
                    </p>
                  </div>
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.color}`}
                  >
                    <Icon size={19} />
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-[#EEE5DC]">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-[#FAF8F5] text-xs uppercase text-[#78866B]">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Ca dự kiến</th>
                  <th className="px-4 py-3">Thực tế</th>
                  <th className="px-4 py-3">Kết quả</th>
                  <th className="px-4 py-3">Thời gian làm</th>
                  <th className="px-4 py-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE5DC]">
                {attendance.rows.length ? (
                  attendance.rows.map((row) => {
                    const baseDate = row.scheduledStart || row.clockIn;
                    return (
                      <tr key={row.key} className="text-[#4F4741]">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[#2A211D]">
                          {baseDate ? formatAttendanceDate(baseDate) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {row.scheduledStart && row.scheduledEnd
                            ? `${formatAttendanceTime(row.scheduledStart)} – ${formatAttendanceTime(row.scheduledEnd)}`
                            : "Ngoài lịch"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {row.clockIn
                            ? `${formatAttendanceTime(row.clockIn)} – ${row.clockOut ? formatAttendanceTime(row.clockOut) : "Đang làm"}`
                            : "Chưa chấm công"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${rowStatusClass(row.status)}`}
                          >
                            {attendanceStatusLabels[row.status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          {row.workedSeconds
                            ? formatAttendanceDuration(row.workedSeconds)
                            : "—"}
                          {row.overtimeSeconds > 0 && (
                            <span className="ml-2 text-xs text-violet-700">
                              +{formatAttendanceDuration(row.overtimeSeconds)} OT
                            </span>
                          )}
                        </td>
                        <td className="max-w-[260px] px-4 py-3 text-xs text-[#8A817B]">
                          {row.adjustmentReason || row.leaveRequest?.reason || "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[#8A817B]">
                      Tháng này chưa có dữ liệu chấm công.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === "PAYROLL" && payroll ? (
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-[#EEE5DC] bg-[#FAF8F5] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span
                className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${status?.className}`}
              >
                {status?.label}
              </span>
              <p className="mt-2 text-sm text-[#6B625C]">{status?.note}</p>
            </div>
            <button
              type="button"
              disabled={!entry || payroll.status === "DRAFT" || downloading}
              onClick={() => void downloadPayslip()}
              title={
                payroll.status === "DRAFT"
                  ? "Phiếu chỉ được tải sau khi Admin chốt lương"
                  : "Tải phiếu lương PDF"
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#B5AAA4]"
            >
              {downloading ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Download size={17} />
              )}
              Tải phiếu lương
            </button>
          </div>

          {entry ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {
                    label: "Lương giờ",
                    value: money(entry.baseAmount),
                    icon: Banknote,
                    color: "bg-blue-50 text-blue-700",
                  },
                  {
                    label: "Lương tăng ca",
                    value: money(entry.overtimeAmount),
                    icon: Clock3,
                    color: "bg-violet-50 text-violet-700",
                  },
                  {
                    label: "Tổng khấu trừ",
                    value: `-${money(entry.totalDeductionAmount)}`,
                    icon: ReceiptText,
                    color: "bg-red-50 text-red-600",
                  },
                  {
                    label: "Thực nhận",
                    value: money(entry.totalAmount),
                    icon: WalletCards,
                    color: "bg-emerald-50 text-emerald-700",
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#EEE5DC] p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs text-[#78866B]">{card.label}</p>
                        <p className="mt-1 truncate font-bold text-[#2A211D]">
                          {card.value}
                        </p>
                      </div>
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.color}`}
                      >
                        <Icon size={19} />
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#EEE5DC] p-5">
                  <h3 className="font-bold text-[#2A211D]">Cách tính thu nhập</h3>
                  <div className="mt-4 space-y-3 text-sm text-[#6B625C]">
                    <div className="flex justify-between gap-4">
                      <span>Đơn giá</span>
                      <strong className="text-[#2A211D]">
                        {money(entry.hourlyRateSnapshot)}/giờ
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Giờ làm</span>
                      <strong className="text-[#2A211D]">
                        {formatAttendanceDuration(entry.regularSeconds)}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Tăng ca ×{entry.overtimeMultiplierSnapshot}</span>
                      <strong className="text-[#2A211D]">
                        {formatAttendanceDuration(entry.overtimeSeconds)} · {money(entry.overtimeAmount)}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-[#EEE5DC] pt-3">
                      <span>Thưởng</span>
                      <strong className="text-emerald-700">
                        +{money(entry.bonusAmount)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#EEE5DC] p-5">
                  <h3 className="font-bold text-[#2A211D]">Chi tiết khấu trừ</h3>
                  <div className="mt-4 space-y-3 text-sm text-[#6B625C]">
                    <div className="flex justify-between gap-4">
                      <span>Đi trễ {entry.lateMinutes} phút</span>
                      <strong className="text-red-600">
                        -{money(entry.lateDeductionAmount)}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Về sớm không phép {entry.unexcusedEarlyLeaveMinutes} phút</span>
                      <strong className="text-red-600">
                        -{money(entry.earlyLeaveDeductionAmount)}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Vắng không phép</span>
                      <strong className="text-red-600">
                        -{money(entry.absenceDeductionAmount)}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Điều chỉnh khác</span>
                      <strong className="text-red-600">
                        -{money(entry.deductionAmount)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {entry.adjustments.length > 0 && (
                <div className="mt-4 rounded-2xl border border-[#EEE5DC] p-5">
                  <h3 className="font-bold text-[#2A211D]">Khoản cộng / trừ khác</h3>
                  <div className="mt-3 divide-y divide-[#EEE5DC]">
                    {entry.adjustments.map((adjustment) => (
                      <div
                        key={adjustment.id}
                        className="flex items-center justify-between gap-4 py-3 text-sm"
                      >
                        <span className="text-[#6B625C]">{adjustment.reason}</span>
                        <strong
                          className={
                            adjustment.type === "BONUS"
                              ? "text-emerald-700"
                              : "text-red-600"
                          }
                        >
                          {adjustment.type === "BONUS" ? "+" : "-"}
                          {money(adjustment.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-14 text-center text-sm text-[#8A817B]">
              Tháng này chưa có dữ liệu lương của bạn.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
