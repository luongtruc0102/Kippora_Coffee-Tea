"use client";

import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAppToast } from "@/components/ui/app-toast-provider";
import { getProfitabilityReport } from "@/services/profitability.service";
import { getBranches } from "@/services/store-settings.service";
import type { ProfitabilityReport } from "@/types/profitability";
import type { BranchStatus } from "@/types/store-settings";

function dateInput(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function monthStart() {
  return `${dateInput().slice(0, 7)}-01`;
}

function daysAgo(days: number) {
  return dateInput(new Date(Date.now() - days * 86_400_000));
}

type DatePreset = "TODAY" | "7D" | "MONTH";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function money(value: number) {
  return currency.format(value);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function displayDate(value: string) {
  return value.split("-").reverse().join("/");
}

type MetricCardProps = {
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "positive" | "negative";
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

function MetricCard({ label, value, hint, tone = "default", icon: Icon }: MetricCardProps) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-red-600"
        : "text-[#2A211D]";
  return (
    <article className="min-w-0 rounded-2xl border border-[#E9DED3] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[#78866B]">{label}</p>
          <p className={`mt-2 truncate text-xl font-bold ${valueClass}`} title={money(value)}>
            {money(value)}
          </p>
          <p className="mt-1 truncate text-xs text-[#94887E]" title={hint}>{hint}</p>
        </div>
        <span className="rounded-xl bg-[#FAF1E8] p-2.5 text-[#C2763D]">
          <Icon size={20} />
        </span>
      </div>
    </article>
  );
}

export default function ProfitabilityPage() {
  const { showToast } = useAppToast();
  const [report, setReport] = useState<ProfitabilityReport | null>(null);
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [branchId, setBranchId] = useState(0);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(dateInput);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    if (!from || !to || from > to) {
      setError("Ngày bắt đầu không được nằm sau ngày kết thúc.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [reportData, branchData] = await Promise.all([
        getProfitabilityReport(accessToken, {
          branchId: branchId || undefined,
          from,
          to,
        }, signal),
        branches.length ? Promise.resolve(branches) : getBranches(accessToken, signal),
      ]);
      setReport(reportData);
      setBranches(branchData);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Không thể tải báo cáo lợi nhuận");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [branchId, branches, from, to]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [load]);

  const branchLabel = useMemo(() => {
    const branch = branches.find((item) => item.id === branchId);
    return branch ? `${branch.code} - ${branch.name}` : "Tất cả chi nhánh";
  }, [branchId, branches]);

  const activeDatePreset = useMemo<DatePreset | null>(() => {
    const today = dateInput();
    if (to !== today) return null;
    if (from === today) return "TODAY";
    if (from === daysAgo(6)) return "7D";
    if (from === `${today.slice(0, 7)}-01`) return "MONTH";
    return null;
  }, [from, to]);

  const qualityIssueCount = report
    ? report.dataQuality.zeroCostAllocations +
      report.dataQuality.paidOrdersWithoutConsumedInventory +
      report.dataQuality.pendingPayrollPeriods +
      report.dataQuality.estimatedCostOrders
    : 0;

  function setRange(range: DatePreset) {
    const today = dateInput();
    setTo(today);
    setFrom(range === "TODAY" ? today : range === "7D" ? daysAgo(6) : `${today.slice(0, 7)}-01`);
  }

  async function exportReport(format: "pdf" | "excel") {
    if (!report) return;
    setExporting(format);
    try {
      if (format === "pdf") {
        const { downloadProfitabilityReportPdf } = await import("@/utils/profitability-report-pdf");
        await downloadProfitabilityReportPdf(report, branchLabel);
      } else {
        const { downloadProfitabilityReportExcel } = await import("@/utils/profitability-report-excel");
        await downloadProfitabilityReportExcel(report, branchLabel);
      }
      showToast(`Đã xuất báo cáo ${format === "pdf" ? "PDF" : "Excel"}`, "success");
    } catch (exportError) {
      showToast(exportError instanceof Error ? exportError.message : "Không thể xuất báo cáo", "error");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C2763D]">Tài chính</p>
          <h1 className="mt-1 text-3xl font-bold text-[#1F1B18]">Giá vốn & lợi nhuận</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#78866B]">
            Kết nối doanh thu đã thu với giá đúng lô nguyên liệu, chi phí được duyệt, bảng lương đã chốt và hao hụt kho.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!report || Boolean(exporting)} onClick={() => void exportReport("excel")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 disabled:opacity-50">
            {exporting === "excel" ? <LoaderCircle className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
            Xuất Excel
          </button>
          <button type="button" disabled={!report || Boolean(exporting)} onClick={() => void exportReport("pdf")} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {exporting === "pdf" ? <LoaderCircle className="animate-spin" size={18} /> : <Download size={18} />}
            Xuất PDF
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E9DED3] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="grid grid-cols-3 rounded-xl bg-[#F5EFE9] p-1">
            {([
              { key: "TODAY", label: "Hôm nay" },
              { key: "7D", label: "7 ngày" },
              { key: "MONTH", label: "Tháng này" },
            ] as const).map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={activeDatePreset === item.key}
                onClick={() => setRange(item.key)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  activeDatePreset === item.key
                    ? "bg-[#4A2C20] text-white shadow-sm"
                    : "text-[#5E5047] hover:bg-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="min-w-0 flex-1 text-sm text-[#6F655E]">
            Chi nhánh
            <select value={branchId} onChange={(event) => setBranchId(Number(event.target.value))} className="mt-1 h-11 w-full rounded-xl border border-[#E4D5C8] bg-white px-3 text-[#2A211D] outline-none focus:border-[#C2763D]">
              <option value={0}>Tất cả chi nhánh</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} - {branch.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-[#6F655E]">
            Từ ngày
            <span className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-[#E4D5C8] px-3"><CalendarDays size={17} className="text-[#C2763D]" /><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="bg-transparent outline-none" /></span>
          </label>
          <label className="text-sm text-[#6F655E]">
            Đến ngày
            <span className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-[#E4D5C8] px-3"><CalendarDays size={17} className="text-[#C2763D]" /><input type="date" value={to} min={from} max={dateInput()} onChange={(event) => setTo(event.target.value)} className="bg-transparent outline-none" /></span>
          </label>
          <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E4D5C8] px-4 text-sm font-semibold text-[#4A2C20] hover:bg-[#FAF6F1]">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
        </div>
      </section>

      {error ? (
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Thử lại</button>
        </section>
      ) : null}

      {loading && !report ? (
        <div className="flex min-h-80 items-center justify-center text-[#78866B]"><LoaderCircle className="mr-2 animate-spin" /> Đang tổng hợp dữ liệu thật...</div>
      ) : report ? (
        <>
          {qualityIssueCount > 0 ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} /><div><p className="font-semibold text-amber-900">Có dữ liệu cần đối soát trước khi chốt báo cáo</p><p className="mt-1 text-sm text-amber-800">{report.dataQuality.zeroCostAllocations} nguyên liệu có giá 0 · {report.dataQuality.paidOrdersWithoutConsumedInventory} đơn chưa có dữ liệu tiêu hao · {report.dataQuality.estimatedCostOrders} đơn cũ dùng giá ước tính · {report.dataQuality.pendingPayrollPeriods} kỳ lương còn nháp.</p></div></div>
            </section>
          ) : null}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Doanh thu thuần" value={report.summary.netRevenue} hint={`${report.summary.paidOrders} đơn đã thu · hoàn ${money(report.summary.refunds)}`} icon={WalletCards} />
            <MetricCard label="Giá vốn nguyên liệu" value={report.summary.cogs} hint="Theo giá lô được dùng cho từng đơn" icon={PackageSearch} />
            <MetricCard label="Lợi nhuận gộp" value={report.summary.grossProfit} hint={`Biên gộp ${report.summary.grossMarginPercent}%`} tone={report.summary.grossProfit >= 0 ? "positive" : "negative"} icon={TrendingUp} />
            <MetricCard label="Chi phí đã duyệt" value={report.summary.approvedExpenses} hint="Không gồm giá vốn và lương" icon={TrendingDown} />
            <MetricCard label="Chi phí lương" value={report.summary.payroll} hint="Chỉ kỳ đã chốt hoặc đã trả" icon={WalletCards} />
            <MetricCard label="Hao hụt kho" value={report.summary.inventoryLoss} hint="Lô hết hạn, hư hỏng hoặc thất thoát" icon={PackageSearch} />
            <MetricCard label="Tổng hoàn tiền" value={report.summary.refunds} hint={`${report.summary.refundCount} chứng từ hoàn`} icon={RotateCcw} />
            <MetricCard label="Lợi nhuận ròng" value={report.summary.netProfit} hint={`Biên ròng ${report.summary.netMarginPercent}%`} tone={report.summary.netProfit >= 0 ? "positive" : "negative"} icon={BarChart3} />
          </section>

          <section className="rounded-2xl border border-[#E9DED3] bg-white p-5 shadow-sm">
            <div><h2 className="text-lg font-bold text-[#2A211D]">Biến động theo ngày</h2><p className="mt-1 text-sm text-[#78866B]">Doanh thu thuần, giá vốn và lợi nhuận ròng trong cùng phạm vi lọc.</p></div>
            <div className="mt-5 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={report.timeline} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#EEE6DE" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value) => displayDate(String(value)).slice(0, 5)} tick={{ fontSize: 11 }} minTickGap={28} />
                  <YAxis tickFormatter={(value) => compactMoney(Number(value))} tick={{ fontSize: 11 }} width={58} />
                  <Tooltip labelFormatter={(value) => displayDate(String(value))} formatter={(value, name) => [money(Number(value)), String(name)]} />
                  <Legend />
                  <Bar dataKey="netRevenue" name="Doanh thu thuần" fill="#D9A066" radius={[5, 5, 0, 0]} maxBarSize={32} />
                  <Line type="monotone" dataKey="cogs" name="Giá vốn" stroke="#8FA47C" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="netProfit" name="Lợi nhuận ròng" stroke="#4A2C20" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E9DED3] bg-white shadow-sm">
            <div className="border-b border-[#EEE4DA] p-5"><h2 className="text-lg font-bold text-[#2A211D]">Kết quả theo chi nhánh</h2></div>
            <div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-left text-sm"><thead className="bg-[#FBF8F5] text-xs uppercase tracking-wide text-[#78866B]"><tr><th className="px-5 py-4">Chi nhánh</th><th className="px-4 py-4 text-right">Đơn đã thu</th><th className="px-4 py-4 text-right">Doanh thu thuần</th><th className="px-4 py-4 text-right">Giá vốn</th><th className="px-4 py-4 text-right">Lãi gộp</th><th className="px-4 py-4 text-right">Chi phí + lương</th><th className="px-5 py-4 text-right">Lợi nhuận ròng</th></tr></thead><tbody className="divide-y divide-[#F0E7DF]">{report.branches.map((branch) => <tr key={branch.branchId} className="hover:bg-[#FFFCF9]"><td className="px-5 py-4"><p className="font-semibold text-[#2A211D]">{branch.branchName}</p><p className="text-xs text-[#8A7E74]">{branch.branchCode}</p></td><td className="px-4 py-4 text-right">{branch.paidOrders}</td><td className="px-4 py-4 text-right font-medium">{money(branch.netRevenue)}</td><td className="px-4 py-4 text-right">{money(branch.cogs)}</td><td className="px-4 py-4 text-right">{money(branch.grossProfit)}</td><td className="px-4 py-4 text-right">{money(branch.approvedExpenses + branch.payroll + branch.inventoryLoss)}</td><td className={`px-5 py-4 text-right font-bold ${branch.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{money(branch.netProfit)}</td></tr>)}</tbody></table></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E9DED3] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#EEE4DA] p-5"><div><h2 className="text-lg font-bold text-[#2A211D]">Giá vốn từng đơn</h2><p className="mt-1 text-sm text-[#78866B]">Có thể truy ngược số tiền thu và chi phí nguyên liệu của từng hóa đơn.</p></div><span className="rounded-full bg-[#F6EFE8] px-3 py-1 text-xs font-semibold text-[#7A513B]">{report.orders.length} đơn</span></div>
            <div className="max-h-[560px] overflow-auto"><table className="min-w-[960px] w-full text-left text-sm"><thead className="sticky top-0 bg-[#FBF8F5] text-xs uppercase tracking-wide text-[#78866B]"><tr><th className="px-5 py-4">Đơn</th><th className="px-4 py-4">Chi nhánh</th><th className="px-4 py-4">Ngày thu</th><th className="px-4 py-4 text-right">Doanh thu</th><th className="px-4 py-4 text-right">Hoàn tiền</th><th className="px-4 py-4 text-right">Giá vốn</th><th className="px-5 py-4 text-right">Lãi sau hoàn</th></tr></thead><tbody className="divide-y divide-[#F0E7DF]">{report.orders.map((order) => <tr key={order.orderId}><td className="px-5 py-4"><p className="font-semibold text-[#2A211D]">#{order.orderId}</p><p className="text-xs text-[#8A7E74]">{order.channel === "POS" ? "Tại quầy" : "Online"}</p></td><td className="px-4 py-4">{order.branchCode}</td><td className="px-4 py-4 text-[#6F655E]">{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(order.paidAt))}</td><td className="px-4 py-4 text-right">{money(order.grossRevenue)}</td><td className="px-4 py-4 text-right text-red-600">{order.refundedAmount ? `-${money(order.refundedAmount)}` : "—"}</td><td className="px-4 py-4 text-right">{money(order.cogs)}<p className={`text-xs ${order.costSource === "LOT" ? "text-emerald-600" : order.costSource === "ESTIMATED" ? "text-amber-600" : "text-red-600"}`}>{order.costSource === "LOT" ? "Theo lô thực tế" : order.costSource === "ESTIMATED" ? "Giá ước tính" : "Thiếu dữ liệu"}</p></td><td className={`px-5 py-4 text-right font-bold ${order.grossProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{money(order.grossProfit)}<p className="text-xs font-normal text-[#8A7E74]">{order.grossMarginPercent}%</p></td></tr>)}</tbody></table></div>
          </section>
        </>
      ) : null}
    </div>
  );
}
