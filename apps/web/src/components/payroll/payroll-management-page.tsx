"use client";

import {
  BadgeDollarSign,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  createPayrollAdjustment,
  deletePayrollAdjustment,
  finalizePayroll,
  generatePayroll,
  markPayrollPaid,
  updatePayrollRoleRates,
} from "@/services/payroll.service";
import { getBranches } from "@/services/store-settings.service";
import type {
  PayrollAdjustment,
  PayrollAdjustmentType,
  PayrollEntry,
  PayrollPaymentMethod,
  PayrollReport,
} from "@/types/payroll";
import type { BranchStatus } from "@/types/store-settings";

type Props = { mode: "ADMIN" | "BRANCH_MANAGER" };

function currentMonthInVietnam() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}

function money(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function duration(seconds: number) {
  if (seconds > 0 && seconds < 60) return `${seconds} giây`;
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} phút`;
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

function DialogFrame({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-[#E8DDD3] bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#EEE5DD] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#2A211D]">{title}</h2>
            <p className="mt-1 text-sm text-[#8A817B]">{description}</p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8A817B] hover:bg-[#F7F2EC]"
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function PayrollManagementPage({ mode }: Props) {
  const { showToast } = useAppToast();
  const [month, setMonth] = useState(currentMonthInVietnam);
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [report, setReport] = useState<PayrollReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<
    "excel" | "pdf" | `payslip:${number}` | null
  >(null);
  const [roleRatesOpen, setRoleRatesOpen] = useState(false);
  const [staffHourlyRate, setStaffHourlyRate] = useState("");
  const [staffOvertimeMultiplier, setStaffOvertimeMultiplier] = useState("");
  const [managerHourlyRate, setManagerHourlyRate] = useState("");
  const [managerOvertimeMultiplier, setManagerOvertimeMultiplier] =
    useState("");
  const [adjustmentEntry, setAdjustmentEntry] = useState<PayrollEntry | null>(
    null,
  );
  const [adjustmentType, setAdjustmentType] =
    useState<PayrollAdjustmentType>("BONUS");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PayrollAdjustment | null>(
    null,
  );
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<PayrollPaymentMethod>("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [adjustmentDetailsEntryId, setAdjustmentDetailsEntryId] = useState<
    number | null
  >(null);
  const adjustmentDetailsEntry = report?.entries.find(
    (entry) => entry.id === adjustmentDetailsEntryId,
  );
  const [salaryDetailsEntryId, setSalaryDetailsEntryId] = useState<
    number | null
  >(null);
  const salaryDetailsEntry = report?.entries.find(
    (entry) => entry.id === salaryDetailsEntryId,
  );

  useEffect(() => {
    if (mode !== "ADMIN") return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    const controller = new AbortController();
    void getBranches(accessToken, controller.signal)
      .then((items) => {
        setBranches(items);
        setBranchId((current) => current ?? items[0]?.id ?? null);
        if (!items.length) setLoading(false);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        showToast(
          error instanceof Error ? error.message : "Không thể tải chi nhánh",
          "error",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [mode, showToast]);

  const loadReport = useCallback(
    async (signal?: AbortSignal, refresh = false) => {
      if (mode === "ADMIN" && !branchId) return;
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        const next = await generatePayroll(
          accessToken,
          month,
          mode === "ADMIN" ? (branchId ?? undefined) : undefined,
          signal,
        );
        setReport(next);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        showToast(
          error instanceof Error ? error.message : "Không thể tải bảng lương",
          "error",
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [branchId, mode, month, showToast],
  );

  useEffect(() => {
    if (mode === "ADMIN" && !branchId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => void loadReport(controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [branchId, loadReport, mode, month]);

  const locked = report?.status !== "DRAFT";
  const selectedBranchLabel = useMemo(() => {
    if (report) return `${report.branch.code} · ${report.branch.name}`;
    return "Chi nhánh";
  }, [report]);

  function openRoleRates() {
    if (!report) return;
    const staff = report.entries.find(
      (entry) => entry.employee.role === "STAFF",
    );
    const manager = report.entries.find(
      (entry) => entry.employee.role === "BRANCH_MANAGER",
    );
    setStaffHourlyRate(
      String(staff?.employee.hourlyRate ?? report.rules.defaultHourlyRate),
    );
    setStaffOvertimeMultiplier(
      String(
        staff?.employee.overtimeMultiplier ??
          report.rules.defaultOvertimeMultiplier,
      ),
    );
    setManagerHourlyRate(
      String(manager?.employee.hourlyRate ?? report.rules.defaultHourlyRate),
    );
    setManagerOvertimeMultiplier(
      String(
        manager?.employee.overtimeMultiplier ??
          report.rules.defaultOvertimeMultiplier,
      ),
    );
    setRoleRatesOpen(true);
  }

  async function saveRoleRates() {
    if (!report || !branchId) return;
    const staffRate = Number(staffHourlyRate);
    const staffMultiplier = Number(staffOvertimeMultiplier);
    const managerRate = Number(managerHourlyRate);
    const managerMultiplier = Number(managerOvertimeMultiplier);
    if (
      !Number.isFinite(staffRate) ||
      !Number.isFinite(managerRate) ||
      staffRate < report.rules.minimumHourlyRate ||
      managerRate < report.rules.minimumHourlyRate
    ) {
      showToast(
        `Lương giờ phải từ ${money(report.rules.minimumHourlyRate)}`,
        "error",
      );
      return;
    }
    if (
      !Number.isFinite(staffMultiplier) ||
      !Number.isFinite(managerMultiplier) ||
      staffMultiplier < 1 ||
      staffMultiplier > 5 ||
      managerMultiplier < 1 ||
      managerMultiplier > 5
    ) {
      showToast("Hệ số tăng ca phải từ 1 đến 5", "error");
      return;
    }
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      const result = await updatePayrollRoleRates(accessToken, {
        branchId,
        staff: {
          hourlyRate: staffRate,
          overtimeMultiplier: staffMultiplier,
        },
        manager: {
          hourlyRate: managerRate,
          overtimeMultiplier: managerMultiplier,
        },
      });
      setRoleRatesOpen(false);
      await loadReport(undefined, true);
      showToast(
        `Đã cập nhật ${result.updated.staff} nhân viên và ${result.updated.managers} nhân viên trưởng`,
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật lương chung",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  function openAdjustment(entry: PayrollEntry) {
    setAdjustmentEntry(entry);
    setAdjustmentType("BONUS");
    setAdjustmentAmount("");
    setAdjustmentReason("");
  }

  async function saveAdjustment() {
    if (!adjustmentEntry) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    const amount = Number(adjustmentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Số tiền điều chỉnh phải lớn hơn 0", "error");
      return;
    }
    if (adjustmentReason.trim().length < 3) {
      showToast("Vui lòng nhập lý do điều chỉnh", "error");
      return;
    }
    try {
      setSaving(true);
      setReport(
        await createPayrollAdjustment(accessToken, adjustmentEntry.id, {
          type: adjustmentType,
          amount,
          reason: adjustmentReason.trim(),
        }),
      );
      setAdjustmentEntry(null);
      showToast(
        adjustmentType === "BONUS"
          ? "Đã thêm khoản thưởng"
          : "Đã thêm khoản khấu trừ",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể thêm khoản điều chỉnh",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeAdjustment() {
    if (!pendingDelete) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      setReport(await deletePayrollAdjustment(accessToken, pendingDelete.id));
      setPendingDelete(null);
      showToast("Đã xóa khoản điều chỉnh", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể xóa khoản điều chỉnh",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    if (!report) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      setReport(await finalizePayroll(accessToken, report.id));
      setConfirmFinalize(false);
      showToast("Đã chốt bảng lương; số liệu hiện đã được khóa", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể chốt bảng lương",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    if (!report) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      setReport(
        await markPayrollPaid(accessToken, report.id, {
          method: paymentMethod,
          ...(paymentReference.trim()
            ? { reference: paymentReference.trim() }
            : {}),
        }),
      );
      setConfirmPayment(false);
      setPaymentReference("");
      showToast("Đã ghi nhận thanh toán bảng lương", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể xác nhận thanh toán lương",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function exportReport(kind: "excel" | "pdf") {
    if (!report || exporting) return;
    try {
      setExporting(kind);
      if (kind === "excel") {
        const { downloadPayrollExcel } =
          await import("@/utils/payroll-report-excel");
        await downloadPayrollExcel(report);
      } else {
        const { downloadPayrollPdf } =
          await import("@/utils/payroll-report-pdf");
        await downloadPayrollPdf(report);
      }
      showToast(`Đã tạo file ${kind === "excel" ? "Excel" : "PDF"}`, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể xuất báo cáo",
        "error",
      );
    } finally {
      setExporting(null);
    }
  }

  async function exportPayslip(entry: PayrollEntry) {
    if (!report || exporting) return;
    try {
      setExporting(`payslip:${entry.id}`);
      const { downloadPayrollPayslip } =
        await import("@/utils/payroll-report-pdf");
      await downloadPayrollPayslip(report, entry);
      showToast("Đã tạo phiếu lương PDF", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể tạo phiếu lương",
        "error",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9894B]">
            Quản lý nhân sự
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1F1B18]">
            Bảng lương nhân viên
          </h1>
          <p className="mt-1 text-sm text-[#78866B]">
            Tính từ giờ chấm công thực tế, tăng ca và các khoản điều chỉnh có lý
            do.
          </p>
        </div>
        {report && (
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              report.status === "PAID"
                ? "bg-emerald-50 text-emerald-700"
                : report.status === "FINALIZED"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {report.status === "PAID" ? (
              <CheckCircle2 size={16} />
            ) : locked ? (
              <LockKeyhole size={16} />
            ) : (
              <Clock3 size={16} />
            )}
            {report.status === "PAID"
              ? "Đã thanh toán"
              : report.status === "FINALIZED"
                ? "Đã chốt · Chờ thanh toán"
                : "Bản nháp tự đồng bộ"}
          </span>
        )}
      </header>

      <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 px-4 py-4">
          {mode === "ADMIN" && (
            <label className="min-w-64">
              <span className="mb-1.5 block text-xs font-semibold text-[#756C64]">
                Chi nhánh
              </span>
              <span className="flex h-11 items-center gap-2 rounded-xl border border-[#DED5CC] px-3">
                <Building2 size={17} className="text-[#C9894B]" />
                <select
                  value={branchId ?? ""}
                  onChange={(event) => setBranchId(Number(event.target.value))}
                  className="h-full flex-1 bg-transparent text-sm font-semibold outline-none"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} · {branch.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          )}
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-[#756C64]">
              Tháng lương
            </span>
            <span className="flex h-11 items-center gap-2 rounded-xl border border-[#DED5CC] px-3">
              <CalendarDays size={17} className="text-[#C9894B]" />
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="bg-transparent text-sm font-semibold outline-none"
              />
            </span>
          </label>
          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => void loadReport(undefined, true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DED5CC] px-4 text-sm font-semibold text-[#5E5650] hover:bg-[#FAF8F5] disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#EEE5DD] bg-[#FCFAF8] px-4 py-3">
          {mode === "ADMIN" && (
            <button
              type="button"
              disabled={!report || saving}
              onClick={openRoleRates}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D9CABE] bg-white px-4 text-sm font-semibold text-[#4A2C20] hover:bg-[#FAF8F5] disabled:opacity-50"
            >
              <UsersRound size={16} />
              Cập nhật lương chung
            </button>
          )}
          <button
            type="button"
            disabled={!report?.entries.length || Boolean(exporting)}
            onClick={() => void exportReport("excel")}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 disabled:opacity-50"
          >
            {exporting === "excel" ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            Xuất Excel
          </button>
          <button
            type="button"
            disabled={!report?.entries.length || Boolean(exporting)}
            onClick={() => void exportReport("pdf")}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D9CABE] bg-[#FFF8EF] px-4 text-sm font-semibold text-[#A45F2F] disabled:opacity-50"
          >
            {exporting === "pdf" ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Xuất PDF
          </button>
          {mode === "ADMIN" && report && !locked && (
            <button
              type="button"
              disabled={!report.canFinalize || saving}
              title={
                report.canFinalize
                  ? "Khóa số liệu của kỳ lương"
                  : report.attendanceReview?.status !== "APPROVED"
                    ? "Cần Admin duyệt bảng công trước khi chốt lương"
                    : "Chỉ chốt sau khi tháng kết thúc"
              }
              onClick={() => setConfirmFinalize(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <LockKeyhole size={16} />
              Chốt bảng lương
            </button>
          )}
          {mode === "ADMIN" && report?.status === "FINALIZED" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmPayment(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Banknote size={16} />
              Xác nhận đã trả
            </button>
          )}
        </div>
        {report?.status === "PAID" && report.paidAt && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
            <span className="font-semibold">
              Đã thanh toán bằng{" "}
              {report.paymentMethod === "BANK_TRANSFER"
                ? "chuyển khoản"
                : "tiền mặt"}
              {report.paymentReference
                ? ` · Mã giao dịch: ${report.paymentReference}`
                : ""}
            </span>
            <span>
              {new Intl.DateTimeFormat("vi-VN", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Asia/Ho_Chi_Minh",
              }).format(new Date(report.paidAt))}
              {report.paidBy?.fullName || report.paidBy?.email
                ? ` · Bởi ${report.paidBy.fullName || report.paidBy.email}`
                : ""}
            </span>
          </div>
        )}
        {report?.status === "DRAFT" && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm ${
              report.attendanceReview?.status === "APPROVED"
                ? "border-emerald-100 bg-emerald-50/70 text-emerald-800"
                : report.attendanceReview?.status === "PENDING"
                  ? "border-amber-100 bg-amber-50/70 text-amber-800"
                  : report.attendanceReview?.status === "RETURNED"
                    ? "border-rose-100 bg-rose-50/70 text-rose-800"
                    : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-2 font-semibold">
              <ShieldCheck size={16} />
              Bảng công:{" "}
              {report.attendanceReview?.status === "APPROVED"
                ? "đã được Admin duyệt"
                : report.attendanceReview?.status === "PENDING"
                  ? "đang chờ Admin duyệt"
                  : report.attendanceReview?.status === "RETURNED"
                    ? "đã trả lại để điều chỉnh"
                    : "trưởng chi nhánh chưa gửi"}
            </span>
            {report.attendanceReview?.reviewNote && (
              <span>Ghi chú: {report.attendanceReview.reviewNote}</span>
            )}
          </div>
        )}
      </section>

      {loading && !report ? (
        <div className="flex min-h-80 items-center justify-center rounded-3xl border border-[#E9E1D8] bg-white">
          <LoaderCircle className="animate-spin text-[#C9894B]" />
        </div>
      ) : report ? (
        <>
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              {
                label: "Tổng thực nhận",
                value: money(report.summary.totalAmount),
                detail: `${report.summary.employees} nhân viên`,
                icon: Banknote,
                tone: "bg-[#FFF3E5] text-[#B86A2E]",
              },
              {
                label: "Giờ làm thường",
                value: duration(report.summary.regularSeconds),
                detail: money(report.summary.baseAmount),
                icon: Clock3,
                tone: "bg-blue-50 text-blue-600",
              },
              {
                label: "Tăng ca",
                value: duration(report.summary.overtimeSeconds),
                detail: money(report.summary.overtimeAmount),
                icon: BadgeDollarSign,
                tone: "bg-violet-50 text-violet-600",
              },
              {
                label: "Điều chỉnh",
                value: `+${money(report.summary.bonusAmount)}`,
                detail: `Khấu trừ ${money(report.summary.totalDeductionAmount)}`,
                icon: Plus,
                tone: "bg-emerald-50 text-emerald-600",
              },
            ].map((card) => (
              <article
                key={card.label}
                className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#78866B]">
                    {card.label}
                  </p>
                  <p className="mt-1 truncate text-lg font-bold text-[#2A211D]">
                    {card.value}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#8A817B]">
                    {card.detail}
                  </p>
                </div>
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.tone}`}
                >
                  <card.icon size={20} />
                </span>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEE5DD] px-5 py-4">
              <div>
                <h2 className="font-bold text-[#2A211D]">
                  {selectedBranchLabel} · {monthLabel(report.month)}
                </h2>
                <p className="mt-0.5 text-xs text-[#8A817B]">
                  Giờ làm tính theo chấm công thực tế; thời gian sau giờ kết
                  thúc ca được tính tăng ca.
                </p>
              </div>
              {report.openAttendances ? (
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  {report.openAttendances} ca chưa kết thúc chưa được tính lương
                </span>
              ) : null}
            </header>

            <div className="overflow-x-auto">
              <table
                className={`w-full text-left ${
                  mode === "ADMIN"
                    ? "min-w-[980px] table-fixed text-[13px] [&_td]:px-2.5 [&_th]:px-2.5"
                    : "min-w-[1280px] text-sm"
                }`}
              >
                {mode === "ADMIN" && (
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                )}
                <thead className="bg-[#FCFAF8] text-[11px] uppercase tracking-wide text-[#78866B]">
                  <tr>
                    <th className="px-5 py-3">Nhân viên</th>
                    <th className="px-4 py-3">Ca làm</th>
                    <th className="px-4 py-3">Giờ làm</th>
                    <th className="px-4 py-3">Tăng ca</th>
                    <th className="px-4 py-3">Đi trễ / về sớm</th>
                    <th className="px-4 py-3 text-right">Lương giờ</th>
                    <th className="px-4 py-3 text-right">Điều chỉnh</th>
                    <th className="px-4 py-3 text-right">Thực nhận</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE5DD]">
                  {report.entries.map((entry) => (
                    <tr key={entry.id} className="align-top hover:bg-[#FFFCF9]">
                      <td className="px-5 py-4">
                        <div
                          className={`flex items-center ${
                            mode === "ADMIN" ? "gap-2" : "gap-3"
                          }`}
                        >
                          <span
                            className={`flex shrink-0 items-center justify-center rounded-full bg-[#F3E9DE] font-bold text-[#4A2C20] ${
                              mode === "ADMIN" ? "h-8 w-8 text-xs" : "h-10 w-10"
                            }`}
                          >
                            {entry.employee.fullName?.trim().charAt(0) || (
                              <UserRound size={17} />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-48 truncate font-bold text-[#2A211D]">
                              {entry.employee.fullName || "Chưa cập nhật tên"}
                            </p>
                            <p className="max-w-48 truncate text-xs text-[#8A817B]">
                              {entry.employee.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-[#2A211D]">
                          {entry.completedShifts}/{entry.scheduledShifts} ca
                        </p>
                        <p className="mt-1 text-xs text-[#8A817B]">
                          Vắng {entry.absentShifts} · Phép{" "}
                          {entry.excusedLeaveShifts}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-semibold text-[#2A211D]">
                        {duration(entry.regularSeconds)}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-violet-700">
                          {duration(entry.overtimeSeconds)}
                        </p>
                        <p className="mt-1 text-xs text-[#8A817B]">
                          {money(entry.overtimeAmount)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-amber-700">
                          Trễ {entry.lateMinutes} phút
                        </p>
                        <p className="mt-1 text-xs text-orange-600">
                          Sớm {entry.earlyLeaveMinutes} phút
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-[#2A211D]">
                        {money(entry.baseAmount)}
                        <button
                          type="button"
                          onClick={() => setSalaryDetailsEntryId(entry.id)}
                          className="ml-auto mt-1 block text-[11px] font-medium text-[#8A817B] underline underline-offset-2 hover:text-[#4A2C20]"
                        >
                          Chi tiết
                        </button>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-semibold text-emerald-700">
                          +{money(entry.bonusAmount)}
                        </p>
                        <p className="font-semibold text-red-600">
                          −{money(entry.totalDeductionAmount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setAdjustmentDetailsEntryId(entry.id)}
                          className="mt-1 text-[11px] font-medium text-[#8A817B] underline underline-offset-2 hover:text-[#4A2C20]"
                        >
                          Chi tiết
                        </button>
                      </td>
                      <td
                        className={`px-4 py-4 text-right font-bold text-[#4A2C20] ${
                          mode === "ADMIN" ? "text-sm" : "text-base"
                        }`}
                      >
                        {money(entry.totalAmount)}
                      </td>
                      <td className="px-5 py-4">
                        <div
                          className={`flex justify-end ${
                            mode === "ADMIN" ? "gap-1" : "gap-2"
                          }`}
                        >
                          {!locked && (
                            <button
                              type="button"
                              title="Thêm thưởng hoặc khấu trừ"
                              onClick={() => openAdjustment(entry)}
                              className={`flex items-center justify-center rounded-xl border border-[#DED5CC] text-emerald-700 hover:bg-emerald-50 ${
                                mode === "ADMIN" ? "h-8 w-8" : "h-9 w-9"
                              }`}
                            >
                              <Plus size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Tải phiếu lương PDF"
                            disabled={Boolean(exporting)}
                            onClick={() => void exportPayslip(entry)}
                            className={`flex items-center justify-center rounded-xl bg-[#4A2C20] text-white disabled:opacity-50 ${
                              mode === "ADMIN" ? "h-8 w-8" : "h-9 w-9"
                            }`}
                          >
                            {exporting === `payslip:${entry.id}` ? (
                              <LoaderCircle
                                size={15}
                                className="animate-spin"
                              />
                            ) : (
                              <Download size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {report.entries.length > 0 && (
                  <tfoot className="border-t-2 border-[#E5D8CB] bg-[#FAF5EE] font-semibold text-[#4A2C20]">
                    <tr>
                      <th
                        scope="row"
                        colSpan={2}
                        className="px-5 py-4 text-left"
                      >
                        Tổng cộng
                        <p className="mt-1 text-xs font-normal text-[#8A817B]">
                          {report.entries.length} nhân viên ·{" "}
                          {monthLabel(report.month)}
                        </p>
                      </th>
                      <td className="px-4 py-4">
                        {duration(report.summary.regularSeconds)}
                      </td>
                      <td className="px-4 py-4">
                        <p>{duration(report.summary.overtimeSeconds)}</p>
                        <p className="mt-1 text-xs font-normal">
                          {money(report.summary.overtimeAmount)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p>
                          Trễ{" "}
                          {report.entries.reduce(
                            (total, entry) => total + entry.lateMinutes,
                            0,
                          )}{" "}
                          phút
                        </p>
                        <p className="mt-1 text-xs">
                          Sớm{" "}
                          {report.entries.reduce(
                            (total, entry) => total + entry.earlyLeaveMinutes,
                            0,
                          )}{" "}
                          phút
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {money(report.summary.baseAmount)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p>+{money(report.summary.bonusAmount)}</p>
                        <p>−{money(report.summary.totalDeductionAmount)}</p>
                      </td>
                      <td className="px-4 py-4 text-right text-base font-bold">
                        {money(report.summary.totalAmount)}
                      </td>
                      <td className="px-5 py-4" />
                    </tr>
                  </tfoot>
                )}
              </table>
              {!report.entries.length && (
                <div className="p-12 text-center text-sm text-[#8A817B]">
                  Chi nhánh chưa có nhân viên hoặc dữ liệu bảng công trong tháng
                  này.
                </div>
              )}
            </div>
          </section>

          <p className="text-xs leading-5 text-[#8A817B]">
            Bảng lương nháp sẽ tính lại khi chấm công hoặc mức lương thay đổi.
            Sau khi chốt, đơn giá, thời gian và các khoản điều chỉnh được giữ
            nguyên để đối soát.
          </p>
        </>
      ) : (
        <div className="rounded-3xl border border-dashed border-[#DED5CC] bg-white p-12 text-center text-sm text-[#8A817B]">
          Chưa có dữ liệu bảng lương để hiển thị.
        </div>
      )}

      {roleRatesOpen && report && (
        <DialogFrame
          title="Cập nhật lương chung"
          description={selectedBranchLabel}
          onClose={() => !saving && setRoleRatesOpen(false)}
        >
          <div className="space-y-4 px-6 py-5">
            <fieldset className="rounded-2xl border border-[#E9E1D8] p-4">
              <legend className="px-2 font-bold text-[#2A211D]">
                Nhân viên
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-[#4A2C20]">
                    Lương một giờ
                  </span>
                  <input
                    type="number"
                    min={report.rules.minimumHourlyRate}
                    step="1000"
                    value={staffHourlyRate}
                    onChange={(event) => setStaffHourlyRate(event.target.value)}
                    className="h-12 w-full rounded-xl border border-[#DED5CC] px-4 outline-none focus:border-[#C9894B]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-[#4A2C20]">
                    Hệ số tăng ca
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={staffOvertimeMultiplier}
                    onChange={(event) =>
                      setStaffOvertimeMultiplier(event.target.value)
                    }
                    className="h-12 w-full rounded-xl border border-[#DED5CC] px-4 outline-none focus:border-[#C9894B]"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-[#E9E1D8] p-4">
              <legend className="px-2 font-bold text-[#2A211D]">
                Nhân viên trưởng
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-[#4A2C20]">
                    Lương một giờ
                  </span>
                  <input
                    type="number"
                    min={report.rules.minimumHourlyRate}
                    step="1000"
                    value={managerHourlyRate}
                    onChange={(event) =>
                      setManagerHourlyRate(event.target.value)
                    }
                    className="h-12 w-full rounded-xl border border-[#DED5CC] px-4 outline-none focus:border-[#C9894B]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-[#4A2C20]">
                    Hệ số tăng ca
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={managerOvertimeMultiplier}
                    onChange={(event) =>
                      setManagerOvertimeMultiplier(event.target.value)
                    }
                    className="h-12 w-full rounded-xl border border-[#DED5CC] px-4 outline-none focus:border-[#C9894B]"
                  />
                </label>
              </div>
            </fieldset>

            <div className="rounded-xl bg-[#FFF8EF] px-4 py-3 text-xs leading-5 text-[#7A624F]">
              Áp dụng cho toàn bộ nhân sự đang hoạt động tại chi nhánh. Kỳ đã
              chốt giữ nguyên; kỳ nháp và các kỳ sau dùng mức lương mới. Hai mức
              được quản lý thống nhất theo nhóm nhân viên và nhân viên trưởng.
            </div>
          </div>
          <footer className="flex justify-end gap-3 border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setRoleRatesOpen(false)}
              className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveRoleRates()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving && <LoaderCircle size={15} className="animate-spin" />}
              Cập nhật lương
            </button>
          </footer>
        </DialogFrame>
      )}

      {salaryDetailsEntry && (
        <DialogFrame
          title="Chi tiết lương giờ"
          description={
            salaryDetailsEntry.employee.fullName ||
            salaryDetailsEntry.employee.email
          }
          onClose={() => setSalaryDetailsEntryId(null)}
        >
          <div className="space-y-4 px-6 py-5 text-sm text-[#4A2C20]">
            <dl className="divide-y divide-[#EEE5DD] rounded-2xl border border-[#E9E1D8] px-4">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[#8A817B]">Mức lương</dt>
                <dd className="font-semibold">
                  {money(salaryDetailsEntry.hourlyRateSnapshot)}/giờ
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[#8A817B]">Giờ làm</dt>
                <dd className="font-semibold">
                  {duration(salaryDetailsEntry.regularSeconds)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[#8A817B]">Lương giờ</dt>
                <dd className="font-bold text-[#4A2C20]">
                  {money(salaryDetailsEntry.baseAmount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[#8A817B]">Hệ số tăng ca</dt>
                <dd className="font-semibold">
                  ×{salaryDetailsEntry.overtimeMultiplierSnapshot}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[#8A817B]">Tiền tăng ca</dt>
                <dd className="font-semibold text-violet-700">
                  {duration(salaryDetailsEntry.overtimeSeconds)} ·{" "}
                  {money(salaryDetailsEntry.overtimeAmount)}
                </dd>
              </div>
            </dl>
            <p className="text-xs leading-5 text-[#8A817B]">
              Lương giờ = thời gian làm thực tế × mức lương theo giờ. Mức lương
              và hệ số trên là dữ liệu của kỳ lương này.
            </p>
          </div>
          <footer className="flex justify-end border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
            <button
              type="button"
              onClick={() => setSalaryDetailsEntryId(null)}
              className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold"
            >
              Đóng
            </button>
          </footer>
        </DialogFrame>
      )}

      {adjustmentEntry && (
        <DialogFrame
          title="Thêm khoản điều chỉnh"
          description={
            adjustmentEntry.employee.fullName || adjustmentEntry.employee.email
          }
          onClose={() => !saving && setAdjustmentEntry(null)}
        >
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F7F2EC] p-1">
              {(["BONUS", "DEDUCTION"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAdjustmentType(type)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                    adjustmentType === type
                      ? type === "BONUS"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "bg-white text-red-600 shadow-sm"
                      : "text-[#8A817B]"
                  }`}
                >
                  {type === "BONUS" ? "Thưởng" : "Khấu trừ"}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#4A2C20]">
                Số tiền
              </span>
              <input
                type="number"
                min="1"
                step="1000"
                value={adjustmentAmount}
                onChange={(event) => setAdjustmentAmount(event.target.value)}
                placeholder="VD: 200000"
                className="h-12 w-full rounded-xl border border-[#DED5CC] px-4 outline-none focus:border-[#C9894B]"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#4A2C20]">
                Lý do
              </span>
              <textarea
                value={adjustmentReason}
                onChange={(event) => setAdjustmentReason(event.target.value)}
                maxLength={255}
                placeholder="VD: Thưởng doanh số tháng"
                className="min-h-24 w-full resize-none rounded-xl border border-[#DED5CC] p-4 outline-none focus:border-[#C9894B]"
              />
            </label>
          </div>
          <footer className="flex justify-end gap-3 border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setAdjustmentEntry(null)}
              className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveAdjustment()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving && <LoaderCircle size={15} className="animate-spin" />}
              Thêm điều chỉnh
            </button>
          </footer>
        </DialogFrame>
      )}

      {adjustmentDetailsEntry && (
        <DialogFrame
          title="Chi tiết điều chỉnh"
          description={
            adjustmentDetailsEntry.employee.fullName ||
            adjustmentDetailsEntry.employee.email
          }
          onClose={() => setAdjustmentDetailsEntryId(null)}
        >
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Tổng cộng</p>
                <p className="mt-1 font-bold text-emerald-700">
                  +{money(adjustmentDetailsEntry.bonusAmount)}
                </p>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-right">
                <p className="text-xs text-red-600">Tổng trừ</p>
                <p className="mt-1 font-bold text-red-600">
                  −{money(adjustmentDetailsEntry.totalDeductionAmount)}
                </p>
              </div>
            </div>

            {adjustmentDetailsEntry.lateDeductionAmount > 0 && (
              <article className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#2A211D]">
                      Khấu trừ tự động do đi trễ
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#8A817B]">
                      {adjustmentDetailsEntry.lateMinutes} phút ×{" "}
                      {money(adjustmentDetailsEntry.hourlyRateSnapshot)}/giờ ÷
                      60, làm tròn đến đồng.
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-red-600">
                    −{money(adjustmentDetailsEntry.lateDeductionAmount)}
                  </p>
                </div>
              </article>
            )}

            {adjustmentDetailsEntry.earlyLeaveMinutes -
              adjustmentDetailsEntry.unexcusedEarlyLeaveMinutes >
              0 && (
              <article className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="font-semibold text-[#2A211D]">
                  Về sớm đã được duyệt
                </p>
                <p className="mt-1 text-xs leading-5 text-[#66785D]">
                  {adjustmentDetailsEntry.earlyLeaveMinutes -
                    adjustmentDetailsEntry.unexcusedEarlyLeaveMinutes}{" "}
                  phút được duyệt, chỉ giảm thời gian làm thực tế và không bị
                  khấu trừ thêm.
                </p>
              </article>
            )}

            {adjustmentDetailsEntry.earlyLeaveDeductionAmount > 0 && (
              <article className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#2A211D]">
                      Khấu trừ tự động do về sớm không phép
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#8A817B]">
                      {adjustmentDetailsEntry.unexcusedEarlyLeaveMinutes} phút ×{" "}
                      {money(adjustmentDetailsEntry.hourlyRateSnapshot)}/giờ ÷
                      60, làm tròn đến đồng.
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-red-600">
                    −{money(adjustmentDetailsEntry.earlyLeaveDeductionAmount)}
                  </p>
                </div>
              </article>
            )}

            {adjustmentDetailsEntry.absenceDeductionAmount > 0 && (
              <article className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#2A211D]">
                      Khấu trừ tự động do vắng không phép
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#8A817B]">
                      {duration(adjustmentDetailsEntry.unexcusedAbsentSeconds)}{" "}
                      × {money(adjustmentDetailsEntry.hourlyRateSnapshot)}/giờ ×{" "}
                      {Math.round(
                        (report?.rules.absencePenaltyRate ?? 0.5) * 100,
                      )}
                      %. Ca vắng không phát sinh lương giờ và bị trừ thêm khoản
                      này.
                    </p>
                  </div>
                  <p className="shrink-0 font-bold text-red-600">
                    −{money(adjustmentDetailsEntry.absenceDeductionAmount)}
                  </p>
                </div>
              </article>
            )}

            {adjustmentDetailsEntry.adjustments.map((adjustment) => (
              <article
                key={adjustment.id}
                className="rounded-xl border border-[#E9E1D8] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-[#2A211D]">
                      {adjustment.reason}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#8A817B]">
                      Bởi{" "}
                      {adjustment.createdBy?.fullName ||
                        adjustment.createdBy?.email ||
                        "người dùng đã xóa"}{" "}
                      ·{" "}
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Asia/Ho_Chi_Minh",
                      }).format(new Date(adjustment.createdAt))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p
                      className={`font-bold ${
                        adjustment.type === "BONUS"
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}
                    >
                      {adjustment.type === "BONUS" ? "+" : "−"}
                      {money(adjustment.amount)}
                    </p>
                    {!locked && (
                      <button
                        type="button"
                        title="Xóa khoản điều chỉnh"
                        onClick={() => setPendingDelete(adjustment)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}

            {!adjustmentDetailsEntry.lateDeductionAmount &&
              !adjustmentDetailsEntry.earlyLeaveMinutes &&
              !adjustmentDetailsEntry.earlyLeaveDeductionAmount &&
              !adjustmentDetailsEntry.absenceDeductionAmount &&
              !adjustmentDetailsEntry.adjustments.length && (
                <p className="rounded-xl bg-[#FCFAF8] p-5 text-center text-sm text-[#8A817B]">
                  Chưa phát sinh khoản cộng hoặc trừ nào.
                </p>
              )}
          </div>
          <footer className="flex justify-end border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
            <button
              type="button"
              onClick={() => setAdjustmentDetailsEntryId(null)}
              className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold"
            >
              Đóng
            </button>
          </footer>
        </DialogFrame>
      )}

      {pendingDelete && (
        <DialogFrame
          title="Xóa khoản điều chỉnh?"
          description="Tổng thực nhận sẽ được tính lại ngay sau khi xóa."
          onClose={() => !saving && setPendingDelete(null)}
        >
          <div className="px-6 py-5">
            <div className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4">
              <p className="font-semibold text-[#2A211D]">
                {pendingDelete.reason}
              </p>
              <p
                className={`mt-1 text-lg font-bold ${
                  pendingDelete.type === "BONUS"
                    ? "text-emerald-700"
                    : "text-red-600"
                }`}
              >
                {pendingDelete.type === "BONUS" ? "+" : "−"}
                {money(pendingDelete.amount)}
              </p>
            </div>
          </div>
          <footer className="flex justify-end gap-3 border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setPendingDelete(null)}
              className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold"
            >
              Giữ lại
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void removeAdjustment()}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}
              Xóa điều chỉnh
            </button>
          </footer>
        </DialogFrame>
      )}

      {mode === "ADMIN" && confirmPayment && report && (
        <DialogFrame
          title="Xác nhận đã trả lương?"
          description={`${selectedBranchLabel} · ${monthLabel(report.month)}`}
          onClose={() => !saving && setConfirmPayment(false)}
        >
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
              Hệ thống sẽ ghi nhận toàn bộ{" "}
              <strong>{money(report.summary.totalAmount)}</strong> của kỳ lương
              này đã được chi trả. Thao tác không thể thực hiện lần hai.
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[#4A2C20]">
                Phương thức thanh toán
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "BANK_TRANSFER", label: "Chuyển khoản" },
                  { value: "CASH", label: "Tiền mặt" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setPaymentMethod(option.value as PayrollPaymentMethod)
                    }
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                      paymentMethod === option.value
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-[#DED5CC] text-[#5E5650]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {paymentMethod === "BANK_TRANSFER" && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#4A2C20]">
                  Mã giao dịch (không bắt buộc)
                </span>
                <input
                  value={paymentReference}
                  maxLength={100}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="VD: FT260907123456"
                  className="h-12 w-full rounded-xl border border-[#DED5CC] px-4 text-sm outline-none focus:border-emerald-600"
                />
              </label>
            )}
          </div>
          <footer className="flex justify-end gap-3 border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmPayment(false)}
              className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void markPaid()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Xác nhận đã trả
            </button>
          </footer>
        </DialogFrame>
      )}

      {mode === "ADMIN" && confirmFinalize && report && (
        <DialogFrame
          title="Chốt bảng lương?"
          description={`${selectedBranchLabel} · ${monthLabel(report.month)}`}
          onClose={() => !saving && setConfirmFinalize(false)}
        >
          <div className="px-6 py-5">
            <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              Sau khi chốt, mức lương, giờ làm và thưởng/khấu trừ của kỳ này sẽ
              không thể chỉnh sửa. Tổng cần thanh toán là{" "}
              <strong>{money(report.summary.totalAmount)}</strong>.
            </div>
          </div>
          <footer className="flex justify-end gap-3 border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmFinalize(false)}
              className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold"
            >
              Xem lại
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void finalize()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Xác nhận chốt
            </button>
          </footer>
        </DialogFrame>
      )}
    </div>
  );
}
