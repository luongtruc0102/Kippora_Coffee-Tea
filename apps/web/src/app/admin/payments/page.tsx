"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CreditCard,
  Eye,
  FileDown,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  WalletCards,
} from "lucide-react";

import PaymentDetailModal from "@/components/admin/payment-detail-modal";
import ToastMessage from "@/components/ui/toast-message";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  getManagedPayments,
  updateManagedPaymentStatus,
} from "@/services/payment.service";
import type { PaymentStatus } from "@/types/order";
import type { ManagedPayment, UpdatePaymentStatusInput } from "@/types/payment";
import {
  filterPayments,
  getLocalPaymentDateKey as getLocalDateKey,
  getPaymentMethodLabel as getMethodLabel,
  hasInvalidPaymentDateRange,
  paymentStatusLabels,
  summarizePayments,
  type PaymentMethodFilter as MethodFilter,
} from "@/utils/payment.util";

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusClass(status: PaymentStatus) {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-700";
    case "PAID":
      return "bg-emerald-50 text-emerald-700";
    case "FAILED":
      return "bg-red-50 text-red-600";
    case "CANCELLED":
      return "bg-[#F3F0ED] text-[#6E625B]";
    case "REFUNDED":
      return "bg-violet-50 text-violet-700";
  }
}

export default function AdminPaymentsPage() {
  const { showToast } = useAppToast();
  const [payments, setPayments] = useState<ManagedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const exportInProgress = useRef(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("ALL");
  const [method, setMethod] = useState<MethodFilter>("ALL");
  const [status, setStatus] = useState<"ALL" | PaymentStatus>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<ManagedPayment | null>(
    null,
  );
  const [updatingPaymentId, setUpdatingPaymentId] = useState<number | null>(
    null,
  );

  const loadPayments = useCallback(
    async (signal?: AbortSignal, isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError("");

        const accessToken = sessionStorage.getItem("accessToken");
        if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");

        const data = await getManagedPayments(accessToken, signal);
        setPayments(data);
        setSelectedPayment((current) =>
          current
            ? (data.find((payment) => payment.id === current.id) ?? null)
            : null,
        );
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải danh sách thanh toán",
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadPayments(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadPayments]);

  const branches = useMemo(() => {
    const branchMap = new Map<number, ManagedPayment["order"]["branch"]>();

    for (const payment of payments) {
      branchMap.set(payment.order.branch.id, payment.order.branch);
    }

    return Array.from(branchMap.values()).sort((left, right) =>
      left.code.localeCompare(right.code, "vi"),
    );
  }, [payments]);

  const filters = useMemo(
    () => ({ search, branchId, method, status, dateFrom, dateTo }),
    [search, branchId, method, status, dateFrom, dateTo],
  );
  const invalidDateRange = hasInvalidPaymentDateRange(filters);
  const filteredPayments = useMemo(
    () => filterPayments(payments, filters),
    [payments, filters],
  );
  const summary = useMemo(
    () => summarizePayments(filteredPayments),
    [filteredPayments],
  );

  async function handleExportReport(format: "pdf" | "xlsx") {
    if (
      exportInProgress.current ||
      loading ||
      refreshing ||
      Boolean(error) ||
      updatingPaymentId !== null
    )
      return;
    if (invalidDateRange) {
      showToast("Ngày bắt đầu không được sau ngày kết thúc.", "error");
      return;
    }
    if (filteredPayments.length === 0) {
      showToast("Không có giao dịch phù hợp để xuất báo cáo.", "info");
      return;
    }

    // Chụp cùng dữ liệu/bộ lọc cho cả hai định dạng trước khi tải thư viện xuất file.
    const branch = branches.find((item) => item.id === Number(branchId));
    const snapshot = {
      payments: structuredClone(filteredPayments),
      filters: { ...filters },
      branchLabel: branch
        ? `${branch.code} - ${branch.name}`
        : "Tất cả chi nhánh",
      generatedAt: new Date(),
      timeZone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh",
    };

    exportInProgress.current = true;
    setExporting(format);
    const label = format === "pdf" ? "PDF" : "Excel";
    try {
      if (format === "pdf") {
        const { downloadPaymentReportPdf } =
          await import("@/utils/payment-report-pdf");
        await downloadPaymentReportPdf(snapshot);
      } else {
        const { downloadPaymentReportExcel } =
          await import("@/utils/payment-report-excel");
        await downloadPaymentReportExcel(snapshot);
      }
      showToast(
        `Đã tạo báo cáo ${label} gồm ${snapshot.payments.length} giao dịch.`,
        "success",
      );
    } catch (exportError) {
      showToast(
        exportError instanceof Error
          ? exportError.message
          : `Không thể xuất báo cáo ${label}. Vui lòng thử lại.`,
        "error",
      );
    } finally {
      exportInProgress.current = false;
      setExporting(null);
    }
  }

  const hasFilters =
    search ||
    branchId !== "ALL" ||
    method !== "ALL" ||
    status !== "ALL" ||
    dateFrom ||
    dateTo;

  function clearFilters() {
    setSearch("");
    setBranchId("ALL");
    setMethod("ALL");
    setStatus("ALL");
    setDateFrom("");
    setDateTo("");
  }

  async function handleUpdatePayment(
    payment: ManagedPayment,
    input: UpdatePaymentStatusInput,
  ) {
    try {
      setUpdatingPaymentId(payment.id);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");

      const updated = await updateManagedPaymentStatus(
        accessToken,
        payment.id,
        input,
      );

      setPayments((current) =>
        current.map((item) =>
          item.id === payment.id ? { ...item, ...updated } : item,
        ),
      );
      setSelectedPayment((current) =>
        current?.id === payment.id ? { ...current, ...updated } : current,
      );

      showToast(
        `Thanh toán #${payment.id}: ${paymentStatusLabels[updated.status]}`,
        "success",
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Không thể cập nhật trạng thái thanh toán",
      );
    } finally {
      setUpdatingPaymentId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#1F1B18]">
            Quản lý thanh toán
          </h2>
          <p className="mt-1 text-[#78866B]">
            Theo dõi, đối soát và cập nhật giao dịch của toàn hệ thống.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={
              loading ||
              refreshing ||
              Boolean(exporting) ||
              updatingPaymentId !== null ||
              Boolean(error) ||
              invalidDateRange ||
              filteredPayments.length === 0
            }
            aria-busy={exporting === "pdf"}
            title="Tải báo cáo A4 đứng gồm các giao dịch và thống kê theo bộ lọc đang chọn"
            onClick={() => void handleExportReport("pdf")}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D9CABE] bg-white px-4 text-sm font-semibold text-[#4A2C20] hover:bg-[#F7F2EC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting === "pdf" ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <FileDown size={17} />
            )}
            {exporting === "pdf" ? "Đang tạo PDF..." : "Tải báo cáo PDF"}
          </button>
          <button
            type="button"
            disabled={
              loading ||
              refreshing ||
              Boolean(exporting) ||
              updatingPaymentId !== null ||
              Boolean(error) ||
              invalidDateRange ||
              filteredPayments.length === 0
            }
            aria-busy={exporting === "xlsx"}
            title="Tải Excel gồm Tổng quan và Chi tiết giao dịch theo bộ lọc đang chọn"
            onClick={() => void handleExportReport("xlsx")}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting === "xlsx" ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={17} />
            )}
            {exporting === "xlsx" ? "Đang tạo Excel..." : "Xuất Excel"}
          </button>
          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => void loadPayments(undefined, true)}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white hover:bg-[#382118] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      <ToastMessage message={error} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<CheckCircle2 size={21} />}
          label="Tổng đã thu"
          value={formatCurrency(summary.collectedAmount)}
          description={`${summary.paidCount} giao dịch thành công`}
          color="emerald"
        />
        <SummaryCard
          icon={<Banknote size={21} />}
          label="Tiền mặt tại quầy"
          value={formatCurrency(summary.cashAmount)}
          description="Các đơn POS đã thanh toán"
          color="orange"
        />
        <SummaryCard
          icon={<CreditCard size={21} />}
          label="Chuyển khoản"
          value={formatCurrency(summary.bankTransferAmount)}
          description="Giao dịch chuyển khoản đã xác nhận"
          color="blue"
        />
        <SummaryCard
          icon={<CircleAlert size={21} />}
          label="Chờ thanh toán"
          value={formatCurrency(summary.pendingAmount)}
          description={`${summary.pendingCount} giao dịch đang chờ`}
          color="amber"
        />
      </div>

      <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_180px_180px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã thanh toán, mã đơn, khách hàng..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none focus:border-[#C9894B]"
            />
          </div>

          <SelectFilter
            value={branchId}
            onChange={setBranchId}
            icon={<Building2 size={17} />}
          >
            <option value="ALL">Tất cả chi nhánh</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} - {branch.name}
              </option>
            ))}
          </SelectFilter>

          <SelectFilter
            value={method}
            onChange={(value) => setMethod(value as MethodFilter)}
            icon={<WalletCards size={17} />}
          >
            <option value="ALL">Tất cả phương thức</option>
            <option value="CASH">Tiền mặt</option>
            <option value="COD">COD</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
          </SelectFilter>

          <SelectFilter
            value={status}
            onChange={(value) => setStatus(value as "ALL" | PaymentStatus)}
            icon={<CheckCircle2 size={17} />}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="FAILED">Thất bại</option>
            <option value="CANCELLED">Đã hủy</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
          </SelectFilter>
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t border-[#F0E8E0] pt-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <DateFilter
              id="payment-date-from"
              label="Từ ngày"
              value={dateFrom}
              max={dateTo || getLocalDateKey(new Date())}
              onChange={(value) => setDateFrom(value)}
            />
            <DateFilter
              id="payment-date-to"
              label="Đến ngày"
              value={dateTo}
              min={dateFrom || undefined}
              max={getLocalDateKey(new Date())}
              onChange={(value) => setDateTo(value)}
            />

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#E9E1D8] px-3 text-sm font-semibold text-[#6E625B] hover:bg-[#F7F2EC]"
              >
                <RotateCcw size={16} />
                Xóa bộ lọc
              </button>
            )}
          </div>

          <p className="text-sm text-[#78866B]">
            Hiển thị {filteredPayments.length}/{payments.length} giao dịch
          </p>
        </div>
        {invalidDateRange && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            Ngày bắt đầu không được sau ngày kết thúc.
          </p>
        )}
        <p className="mt-3 text-xs text-[#8A817B]">
          Báo cáo PDF và Excel xuất đúng danh sách và thống kê theo bộ lọc đang
          chọn.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-[#78866B]">
            Đang tải danh sách thanh toán...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] table-fixed">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[18%]" />
                <col className="w-[15%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
              </colgroup>
              <thead className="bg-[#FAF8F5]">
                <tr className="border-b border-[#E9E1D8] text-left text-xs font-semibold uppercase tracking-wide text-[#78866B]">
                  <th className="px-5 py-4">Mã giao dịch</th>
                  <th className="px-5 py-4">Khách hàng</th>
                  <th className="px-5 py-4">Chi nhánh</th>
                  <th className="px-5 py-4">Phương thức</th>
                  <th className="px-5 py-4">Số tiền</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4">Thời gian</th>
                  <th className="px-5 py-4 text-right">Xem</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-14 text-center text-sm text-[#78866B]"
                    >
                      Không tìm thấy giao dịch thanh toán phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-[#F0E8E0] transition last:border-b-0 hover:bg-[#FCFAF7]"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#4A2C20]">
                          #{payment.id}
                        </p>
                        <p className="mt-1 text-xs text-[#8A817B]">
                          Đơn #{payment.orderId} · {payment.order.channel}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="truncate font-semibold text-[#1F1B18]">
                          {payment.order.receiverName}
                        </p>
                        <p className="mt-1 truncate text-xs text-[#8A817B]">
                          {payment.order.receiverPhone ||
                            payment.order.user.email}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#1F1B18]">
                          {payment.order.branch.code}
                        </p>
                        <p className="mt-1 truncate text-xs text-[#8A817B]">
                          {payment.order.branch.name}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#5E5650]">
                        {getMethodLabel(payment)}
                      </td>
                      <td className="px-5 py-4 font-bold text-[#4A2C20]">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClass(
                            payment.status,
                          )}`}
                        >
                          {paymentStatusLabels[payment.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#5E5650]">
                        {formatDate(payment.paidAt || payment.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            title="Xem chi tiết thanh toán"
                            onClick={() => setSelectedPayment(payment)}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-[#F7F2EC] text-[#5F7254] hover:bg-[#EAF3E7] hover:text-[#3F5D38]"
                          >
                            <Eye size={17} />
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

      <PaymentDetailModal
        open={selectedPayment !== null}
        payment={selectedPayment}
        updating={updatingPaymentId !== null}
        onClose={() => setSelectedPayment(null)}
        onUpdate={handleUpdatePayment}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  color: "emerald" | "orange" | "blue" | "amber";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#78866B]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#1F1B18]">{value}</p>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#8A817B]">{description}</p>
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  icon,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#C9894B]">
        {icon}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-10 pr-9 text-sm outline-none focus:border-[#C9894B]"
      >
        {children}
      </select>
      <ChevronDown
        size={17}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
      />
    </div>
  );
}

function DateFilter({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#78866B]"
      >
        <CalendarDays size={14} className="text-[#C9894B]" />
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] px-3 text-sm outline-none focus:border-[#C9894B]"
      />
    </div>
  );
}
