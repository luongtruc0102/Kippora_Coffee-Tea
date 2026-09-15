"use client";

import {
  AlertTriangle,
  BookCheck,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  closeMonth,
  getMonthCloseOverview,
  reopenMonth,
} from "@/services/month-close.service";
import { getBranches } from "@/services/store-settings.service";
import type { MonthCloseOverview } from "@/types/month-close";
import type { ProfitabilityReport } from "@/types/profitability";
import type { BranchStatus } from "@/types/store-settings";

type Props = { mode: "ADMIN" | "BRANCH_MANAGER" };

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function money(value: number) {
  return currency.format(value);
}

function previousMonth() {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `tháng ${Number(month)} năm ${year}`;
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

function reportFor(
  overview: MonthCloseOverview | null,
): ProfitabilityReport | null {
  if (!overview) return null;
  if (overview.status === "CLOSED" && overview.period?.snapshot?.report) {
    return overview.period.snapshot.report;
  }
  return overview.liveReport;
}

export default function MonthClosePage({ mode }: Props) {
  const { showToast } = useAppToast();
  const [month, setMonth] = useState(previousMonth);
  const [branchId, setBranchId] = useState(0);
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [overview, setOverview] = useState<MonthCloseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"CLOSE" | "REOPEN" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        setError("");
        if (mode === "ADMIN" && !branchId) {
          const branchData = await getBranches(accessToken, signal);
          const activeBranches = branchData.filter((item) => item.isActive);
          setBranches(branchData);
          if (activeBranches[0]) setBranchId(activeBranches[0].id);
          else setError("Chưa có chi nhánh đang hoạt động để chốt sổ.");
          return;
        }
        const [overviewData, branchData] = await Promise.all([
          getMonthCloseOverview(
            accessToken,
            month,
            mode === "ADMIN" ? branchId : undefined,
            signal,
          ),
          mode === "ADMIN"
            ? getBranches(accessToken, signal)
            : Promise.resolve([]),
        ]);
        setOverview(overviewData);
        if (mode === "ADMIN") setBranches(branchData);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải kỳ kế toán",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [branchId, mode, month],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  const report = useMemo(() => reportFor(overview), [overview]);
  const isClosed = overview?.status === "CLOSED";
  const branchLabel = overview
    ? `${overview.branch.code} - ${overview.branch.name}`
    : "Chi nhánh";

  async function submitAction() {
    if (!overview || !action) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    if (action === "REOPEN" && note.trim().length < 5) {
      showToast("Vui lòng nhập lý do mở lại ít nhất 5 ký tự", "error");
      return;
    }
    try {
      setSubmitting(true);
      if (action === "CLOSE") {
        await closeMonth(accessToken, {
          month,
          branchId: overview.branch.id,
          note: note.trim() || undefined,
        });
        showToast(`Đã chốt sổ ${monthLabel(month)}`, "success");
      } else {
        await reopenMonth(accessToken, {
          month,
          branchId: overview.branch.id,
          reason: note.trim(),
        });
        showToast(`Đã mở lại sổ ${monthLabel(month)}`, "success");
      }
      setAction(null);
      setNote("");
      await load();
    } catch (submitError) {
      showToast(
        submitError instanceof Error
          ? submitError.message
          : "Không thể cập nhật kỳ",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function exportReport(format: "pdf" | "excel") {
    if (!report) return;
    setExporting(format);
    try {
      if (format === "pdf") {
        const { downloadProfitabilityReportPdf } =
          await import("@/utils/profitability-report-pdf");
        await downloadProfitabilityReportPdf(report, branchLabel);
      } else {
        const { downloadProfitabilityReportExcel } =
          await import("@/utils/profitability-report-excel");
        await downloadProfitabilityReportExcel(report, branchLabel);
      }
      showToast(
        `Đã xuất báo cáo ${format === "pdf" ? "PDF" : "Excel"}`,
        "success",
      );
    } catch (exportError) {
      showToast(
        exportError instanceof Error
          ? exportError.message
          : "Không thể xuất báo cáo",
        "error",
      );
    } finally {
      setExporting(null);
    }
  }

  function destination(href: string | null) {
    if (!href || mode === "ADMIN") return href;
    const staffHref = href.replace("/admin/", "/staff/");
    return [
      "/staff/cash-reconciliation",
      "/staff/expenses",
      "/staff/inventory-counts",
      "/staff/orders",
      "/staff/payroll",
    ].includes(staffHref)
      ? staffHref
      : null;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C2763D]">
            Tài chính
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#1F1B18]">
            Chốt sổ cuối tháng
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#78866B]">
            Đối soát toàn bộ chứng từ và lưu báo cáo doanh thu, giá vốn, chi
            phí, lương, hao hụt thành snapshot bất biến.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!report || Boolean(exporting)}
            onClick={() => void exportReport("excel")}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 disabled:opacity-50"
          >
            {exporting === "excel" ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={18} />
            )}{" "}
            Xuất Excel
          </button>
          <button
            type="button"
            disabled={!report || Boolean(exporting)}
            onClick={() => void exportReport("pdf")}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D9B99E] bg-white px-4 text-sm font-semibold text-[#9A5C2F] disabled:opacity-50"
          >
            {exporting === "pdf" ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}{" "}
            Xuất PDF
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />{" "}
            Làm mới
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E9DED3] bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[280px_1fr_auto] xl:items-end">
          <label className="text-sm font-medium text-[#665A52]">
            Tháng kế toán
            <input
              type="month"
              max={currentMonth()}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-[#E4D5C8] px-3 outline-none focus:border-[#C2763D]"
            />
          </label>
          {mode === "ADMIN" ? (
            <label className="text-sm font-medium text-[#665A52]">
              Chi nhánh
              <select
                value={branchId}
                onChange={(event) => setBranchId(Number(event.target.value))}
                className="mt-1 h-11 w-full rounded-xl border border-[#E4D5C8] bg-white px-3 outline-none focus:border-[#C2763D]"
              >
                {branches
                  .filter((branch) => branch.isActive)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <div>
              <p className="text-sm text-[#887B72]">Chi nhánh</p>
              <p className="mt-2 font-semibold text-[#2A211D]">{branchLabel}</p>
            </div>
          )}
          {overview && (
            <span
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${isClosed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
            >
              {isClosed ? <LockKeyhole size={18} /> : <History size={18} />}
              {isClosed
                ? `Đã chốt · bản ${overview.period?.version}`
                : "Đang mở"}
            </span>
          )}
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
        </section>
      )}

      {!error && loading && !overview && (
        <section className="rounded-2xl border border-[#E9DED3] bg-white py-20 text-center text-sm text-[#84776E]">
          <LoaderCircle size={24} className="mx-auto mb-3 animate-spin" />
          Đang đối soát dữ liệu trong tháng...
        </section>
      )}

      {!error && overview && report && (
        <>
          <section
            className={`rounded-2xl border p-5 shadow-sm ${isClosed ? "border-emerald-200 bg-emerald-50/60" : overview.canClose ? "border-emerald-200 bg-white" : "border-amber-200 bg-amber-50/40"}`}
          >
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div className="flex items-start gap-3">
                <span
                  className={`rounded-xl p-2.5 ${isClosed ? "bg-emerald-100 text-emerald-700" : overview.canClose ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {isClosed ? (
                    <LockKeyhole size={22} />
                  ) : overview.canClose ? (
                    <ShieldCheck size={22} />
                  ) : (
                    <AlertTriangle size={22} />
                  )}
                </span>
                <div>
                  <h2 className="font-bold text-[#2A211D]">
                    {isClosed
                      ? `Báo cáo đã khóa tại phiên bản ${overview.period?.version}`
                      : overview.canClose
                        ? "Dữ liệu đã sẵn sàng để chốt"
                        : "Còn công việc cần hoàn tất"}
                  </h2>
                  <p className="mt-1 text-sm text-[#74685F]">
                    {isClosed
                      ? `Chốt lúc ${dateTime(overview.period?.closedAt ?? null)} bởi ${overview.period?.closedByName}.`
                      : mode === "ADMIN"
                        ? "Admin cần xử lý hết các mục chặn bên dưới trước khi chốt."
                        : "Nhân viên trưởng hoàn tất công việc chi nhánh; Admin sẽ thực hiện chốt sổ."}
                  </p>
                </div>
              </div>
              {mode === "ADMIN" && (
                <div className="flex gap-2">
                  {isClosed ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNote("");
                        setAction("REOPEN");
                      }}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600"
                    >
                      <RotateCcw size={18} /> Mở lại kỳ
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!overview.canClose}
                      onClick={() => {
                        setNote("");
                        setAction("CLOSE");
                      }}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#B8AEA8]"
                    >
                      <BookCheck size={18} /> Chốt sổ tháng
                    </button>
                  )}
                </div>
              )}
            </div>
            {isClosed && overview.period?.closeNote && (
              <p className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm text-[#665A52]">
                <strong>Ghi chú:</strong> {overview.period.closeNote}
              </p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            {[
              {
                label: "Doanh thu thuần",
                value: report.summary.netRevenue,
                icon: WalletCards,
                tone: "text-[#9A5C2F] bg-[#FAF1E8]",
              },
              {
                label: "Giá vốn",
                value: report.summary.cogs,
                icon: BookCheck,
                tone: "text-blue-700 bg-blue-50",
              },
              {
                label: "Lợi nhuận gộp",
                value: report.summary.grossProfit,
                icon: TrendingUp,
                tone: "text-emerald-700 bg-emerald-50",
              },
              {
                label: "Chi phí",
                value: report.summary.approvedExpenses,
                icon: FileSpreadsheet,
                tone: "text-rose-700 bg-rose-50",
              },
              {
                label: "Lương & hao hụt",
                value: report.summary.payroll + report.summary.inventoryLoss,
                icon: ShieldCheck,
                tone: "text-violet-700 bg-violet-50",
              },
              {
                label: "Lợi nhuận ròng",
                value: report.summary.netProfit,
                icon: TrendingUp,
                tone:
                  report.summary.netProfit >= 0
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-red-700 bg-red-50",
              },
            ].map(({ label, value, icon: Icon, tone }) => (
              <article
                key={label}
                className="min-w-0 rounded-2xl border border-[#E9DED3] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#78866B]">{label}</p>
                    <p
                      className={`mt-2 truncate text-xl font-bold ${value < 0 ? "text-red-600" : "text-[#251D19]"}`}
                      title={money(value)}
                    >
                      {money(value)}
                    </p>
                  </div>
                  <span className={`rounded-xl p-2 ${tone}`}>
                    <Icon size={19} />
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-[#E9DED3] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-[#2A211D]">
                    Điều kiện chốt sổ
                  </h2>
                  <p className="mt-1 text-sm text-[#84776E]">
                    Các mục màu đỏ bắt buộc phải xử lý.
                  </p>
                </div>
                <span className="rounded-full bg-[#F5EFE9] px-3 py-1 text-xs font-semibold text-[#6D5E54]">
                  {overview.blockers.length} mục chặn
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {!overview.blockers.length && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    <CheckCircle2 size={19} /> Không còn chứng từ treo hoặc dữ
                    liệu thiếu.
                  </div>
                )}
                {overview.blockers.map((item) => {
                  const href = destination(item.href);
                  const content = (
                    <>
                      <span className="rounded-lg bg-red-100 p-2 text-red-600">
                        <AlertTriangle size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-[#3E3029]">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-[#8A7D74]">
                          {item.count} mục cần xử lý
                        </span>
                      </span>
                      {href && (
                        <span className="text-xs font-semibold text-[#A85F31]">
                          Mở trang →
                        </span>
                      )}
                    </>
                  );
                  return href ? (
                    <Link
                      key={item.code}
                      href={href}
                      className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/70 px-3 py-3 hover:border-red-200"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      key={item.code}
                      className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/70 px-3 py-3"
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E9DED3] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-[#2A211D]">Lưu ý đối soát</h2>
                  <p className="mt-1 text-sm text-[#84776E]">
                    Không chặn chốt nhưng cần Admin xác nhận.
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  {overview.warnings.length} cảnh báo
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {!overview.warnings.length && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 size={19} /> Không có cảnh báo cần lưu ý.
                  </div>
                )}
                {overview.warnings.map((item) => {
                  const href = destination(item.href);
                  const row = (
                    <>
                      <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
                        <AlertTriangle size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-[#3E3029]">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-[#8A7D74]">
                          {item.count} trường hợp
                        </span>
                      </span>
                    </>
                  );
                  return href ? (
                    <Link
                      key={item.code}
                      href={href}
                      className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3 hover:border-amber-200"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div
                      key={item.code}
                      className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3"
                    >
                      {row}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E9DED3] bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-2 border-b border-[#EFE4DA] p-5 md:flex-row md:items-center">
              <div>
                <h2 className="font-bold text-[#2A211D]">
                  Món đóng góp lợi nhuận
                </h2>
                <p className="mt-1 text-sm text-[#84776E]">
                  Top món theo lợi nhuận gộp trong snapshot đang xem.
                </p>
              </div>
              <p className="text-sm text-[#6F625A]">
                Biên gộp{" "}
                <strong>
                  {number.format(report.summary.grossMarginPercent)}%
                </strong>{" "}
                · Biên ròng{" "}
                <strong>
                  {number.format(report.summary.netMarginPercent)}%
                </strong>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-[#FBF8F5] text-xs uppercase text-[#78866B]">
                  <tr>
                    <th className="px-5 py-3">Món</th>
                    <th className="px-5 py-3 text-right">Đã bán</th>
                    <th className="px-5 py-3 text-right">Doanh thu thuần</th>
                    <th className="px-5 py-3 text-right">Giá vốn</th>
                    <th className="px-5 py-3 text-right">Lợi nhuận gộp</th>
                    <th className="px-5 py-3 text-right">Biên</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE4DA]">
                  {report.products.slice(0, 8).map((product) => (
                    <tr key={product.productId}>
                      <td className="px-5 py-4 font-semibold">
                        {product.productName}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {number.format(product.quantitySold)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {money(product.netRevenue)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {money(product.cogs)}
                      </td>
                      <td
                        className={`px-5 py-4 text-right font-semibold ${product.grossProfit < 0 ? "text-red-600" : "text-emerald-700"}`}
                      >
                        {money(product.grossProfit)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {number.format(product.grossMarginPercent)}%
                      </td>
                    </tr>
                  ))}
                  {!report.products.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-[#8A7D74]"
                      >
                        Tháng này chưa có dữ liệu món đã bán.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9DED3] bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[#F4EEE8] p-2.5 text-[#8D5B3C]">
                <History size={20} />
              </span>
              <div>
                <h2 className="font-bold text-[#2A211D]">Lịch sử kỳ kế toán</h2>
                <p className="mt-1 text-sm text-[#84776E]">
                  Mọi lần chốt hoặc mở lại đều được giữ để truy vết.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {overview.period?.events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-[#EFE4DA] px-4 py-3 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-semibold text-[#342821]">
                      {event.type === "CLOSED"
                        ? `Chốt sổ · phiên bản ${event.version}`
                        : `Mở lại phiên bản ${event.version}`}
                    </p>
                    <p className="mt-1 text-sm text-[#756960]">
                      {event.reason || "Không có ghi chú"}
                    </p>
                  </div>
                  <div className="text-sm md:text-right">
                    <p className="font-medium">{event.actorName}</p>
                    <p className="mt-1 text-xs text-[#8A7D74]">
                      {dateTime(event.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {!overview.period?.events.length && (
                <p className="rounded-xl bg-[#FBF8F5] px-4 py-8 text-center text-sm text-[#8A7D74]">
                  Kỳ này chưa phát sinh lịch sử chốt sổ.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {action && overview && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#EFE4DA] p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C2763D]">
                  {action === "CLOSE"
                    ? "Khóa dữ liệu tháng"
                    : "Điều chỉnh kỳ đã chốt"}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[#251D19]">
                  {action === "CLOSE"
                    ? "Xác nhận chốt sổ"
                    : "Mở lại kỳ kế toán"}
                </h2>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setAction(null)}
                className="rounded-full p-2 text-[#7A6E66] hover:bg-[#F5EFE9]"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div
                className={`rounded-xl border p-4 text-sm ${action === "CLOSE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}
              >
                {action === "CLOSE"
                  ? `Hệ thống sẽ lưu snapshot ${branchLabel} · ${monthLabel(month)}. Báo cáo này không thay đổi theo dữ liệu phát sinh về sau.`
                  : "Sau khi mở lại, Admin cần xử lý chứng từ và chốt lại để tạo phiên bản snapshot mới. Phiên bản cũ vẫn được giữ trong lịch sử."}
              </div>
              <label className="block text-sm font-semibold text-[#4D4038]">
                {action === "CLOSE" ? "Ghi chú đối soát" : "Lý do mở lại *"}
                <textarea
                  rows={4}
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    action === "CLOSE"
                      ? "Ví dụ: Đã đối soát tiền mặt và chứng từ..."
                      : "Nhập sai lệch cần điều chỉnh..."
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-[#E1CDBD] p-3 font-normal outline-none focus:border-[#C2763D]"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#EFE4DA] p-5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setAction(null)}
                className="h-11 rounded-xl border border-[#E1D4C8] px-5 font-semibold text-[#5F5148]"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitAction()}
                className={`inline-flex h-11 items-center gap-2 rounded-xl px-5 font-semibold text-white disabled:opacity-50 ${action === "CLOSE" ? "bg-[#4A2C20]" : "bg-red-600"}`}
              >
                {submitting && (
                  <LoaderCircle size={18} className="animate-spin" />
                )}
                {action === "CLOSE" ? "Chốt sổ" : "Xác nhận mở lại"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
