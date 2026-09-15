"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  History,
  LoaderCircle,
  PackageSearch,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  applyProductPrice,
  getPricingRecommendations,
  getProductPriceHistory,
  updatePricingSettings,
} from "@/services/pricing.service";
import { getBranches } from "@/services/store-settings.service";
import type {
  PricingRecommendation,
  PricingReport,
  PricingSettings,
  PricingStatus,
  ProductPriceHistoryItem,
} from "@/types/pricing";
import type { BranchStatus } from "@/types/store-settings";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

function money(value: number) {
  return currency.format(value);
}

function ingredientUnit(unit: string) {
  if (unit === "GRAM") return "g";
  if (unit === "MILLILITER") return "ml";
  if (unit === "PIECE") return "cái";
  return unit.toLowerCase();
}

const statusView: Record<PricingStatus, { label: string; className: string }> =
  {
    HEALTHY: {
      label: "Đạt mục tiêu",
      className: "bg-emerald-50 text-emerald-700",
    },
    BELOW_TARGET: {
      label: "Dưới mục tiêu",
      className: "bg-amber-50 text-amber-700",
    },
    PRICE_BELOW_COST: {
      label: "Bán dưới giá vốn",
      className: "bg-red-50 text-red-700",
    },
    COST_INCREASE: {
      label: "Giá vốn tăng",
      className: "bg-orange-50 text-orange-700",
    },
    MISSING_COST: {
      label: "Thiếu giá vốn",
      className: "bg-slate-100 text-slate-600",
    },
  };

type StatusFilter = "ALL" | "ATTENTION" | PricingStatus;

export default function PricingPage() {
  const { showToast } = useAppToast();
  const [report, setReport] = useState<PricingReport | null>(null);
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [history, setHistory] = useState<ProductPriceHistoryItem[]>([]);
  const [branchId, setBranchId] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [expandedVariantId, setExpandedVariantId] = useState<number | null>(
    null,
  );
  const [settings, setSettings] = useState<PricingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [applyTarget, setApplyTarget] = useState<PricingRecommendation | null>(
    null,
  );
  const [newPrice, setNewPrice] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        setError("");
        const [reportData, branchData, historyData] = await Promise.all([
          getPricingRecommendations(accessToken, branchId || undefined, signal),
          getBranches(accessToken, signal),
          getProductPriceHistory(accessToken, 30, signal),
        ]);
        setReport(reportData);
        setSettings(reportData.settings);
        setBranches(branchData);
        setHistory(historyData);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải dữ liệu định giá",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [branchId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  const visibleRecommendations = useMemo(() => {
    if (!report) return [];
    const normalizedSearch = search.trim().toLocaleLowerCase("vi");
    return report.recommendations.filter((item) => {
      const matchesSearch = normalizedSearch
        ? `${item.productName} ${item.size} ${item.category.name}`
            .toLocaleLowerCase("vi")
            .includes(normalizedSearch)
        : true;
      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ATTENTION"
            ? item.status !== "HEALTHY"
            : item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [report, search, statusFilter]);

  async function saveSettings() {
    if (!settings) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    if (
      settings.targetMarginPercent < 1 ||
      settings.targetMarginPercent > 95 ||
      settings.costIncreaseAlertPercent < 0 ||
      settings.costIncreaseAlertPercent > 100
    ) {
      showToast(
        "Vui lòng kiểm tra lại biên lợi nhuận và ngưỡng cảnh báo",
        "error",
      );
      return;
    }
    try {
      setSavingSettings(true);
      await updatePricingSettings(accessToken, settings);
      showToast("Đã lưu chính sách định giá", "success");
      await load();
    } catch (saveError) {
      showToast(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu chính sách",
        "error",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  function openApply(item: PricingRecommendation) {
    setApplyTarget(item);
    setNewPrice(String(item.suggestedPrice ?? item.currentPrice));
    setReason("Điều chỉnh theo giá vốn và biên lợi nhuận mục tiêu");
  }

  async function confirmApply() {
    if (!applyTarget) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    const parsedPrice = Number(newPrice);
    if (!Number.isInteger(parsedPrice) || parsedPrice < 1000) {
      showToast("Giá bán mới phải là số nguyên từ 1.000 đ", "error");
      return;
    }
    if (reason.trim().length < 3) {
      showToast("Anh nhập lý do thay đổi giá giúp em nhé", "error");
      return;
    }
    try {
      setApplying(true);
      await applyProductPrice(accessToken, applyTarget.variantId, {
        newPrice: parsedPrice,
        branchId: branchId || undefined,
        reason: reason.trim(),
      });
      setApplyTarget(null);
      showToast(
        `Đã cập nhật giá ${applyTarget.productName} size ${applyTarget.size}`,
        "success",
      );
      await load();
    } catch (applyError) {
      showToast(
        applyError instanceof Error
          ? applyError.message
          : "Không thể áp dụng giá mới",
        "error",
      );
    } finally {
      setApplying(false);
    }
  }

  const proposedPrice = Number(newPrice) || 0;
  const proposedMargin =
    applyTarget && proposedPrice > 0
      ? ((proposedPrice - applyTarget.recipeCost) / proposedPrice) * 100
      : 0;
  const proposedMonthlyDifference = applyTarget
    ? (proposedPrice - applyTarget.currentPrice) *
      applyTarget.last30DaysQuantity
    : 0;

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C2763D]">
            Sản phẩm
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#1F1B18]">
            Định giá món
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#78866B]">
            Tính giá vốn theo các lô còn dùng được, cảnh báo món có biên thấp và
            đề xuất giá bán an toàn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E4D5C8] bg-white px-4 text-sm font-semibold text-[#4A2C20] disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Làm mới dữ liệu
        </button>
      </section>

      <section className="rounded-2xl border border-[#E9DED3] bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-[#FAF1E8] p-2.5 text-[#C2763D]">
            <Settings2 size={20} />
          </span>
          <div>
            <h2 className="font-bold text-[#2A211D]">
              Chính sách định giá chung
            </h2>
            <p className="mt-1 text-sm text-[#84776E]">
              Khi xem toàn chuỗi, hệ thống dùng chi nhánh có giá vốn cao nhất để
              tránh bán lỗ.
            </p>
          </div>
        </div>
        {settings && (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
            <label className="text-sm font-medium text-[#5F544D]">
              Biên lợi nhuận mục tiêu (%)
              <input
                type="number"
                min={1}
                max={95}
                step={0.5}
                value={settings.targetMarginPercent}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    targetMarginPercent: Number(event.target.value),
                  })
                }
                className="mt-1 h-11 w-full rounded-xl border border-[#E4D5C8] px-3 outline-none focus:border-[#C2763D]"
              />
            </label>
            <label className="text-sm font-medium text-[#5F544D]">
              Cảnh báo khi giá vốn tăng (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={settings.costIncreaseAlertPercent}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    costIncreaseAlertPercent: Number(event.target.value),
                  })
                }
                className="mt-1 h-11 w-full rounded-xl border border-[#E4D5C8] px-3 outline-none focus:border-[#C2763D]"
              />
            </label>
            <label className="text-sm font-medium text-[#5F544D]">
              Làm tròn giá đề xuất
              <select
                value={settings.roundingStep}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    roundingStep: Number(event.target.value),
                  })
                }
                className="mt-1 h-11 w-full rounded-xl border border-[#E4D5C8] bg-white px-3 outline-none focus:border-[#C2763D]"
              >
                <option value={500}>500 đ</option>
                <option value={1000}>1.000 đ</option>
                <option value={2000}>2.000 đ</option>
                <option value={5000}>5.000 đ</option>
              </select>
            </label>
            <button
              type="button"
              disabled={savingSettings}
              onClick={() => void saveSettings()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingSettings ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Lưu chính sách
            </button>
          </div>
        )}
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            {[
              {
                label: "Tổng size món",
                value: report?.summary.totalVariants ?? 0,
                icon: PackageSearch,
                tone: "bg-[#FAF1E8] text-[#C2763D]",
              },
              {
                label: "Đạt mục tiêu",
                value: report?.summary.healthy ?? 0,
                icon: Sparkles,
                tone: "bg-emerald-50 text-emerald-700",
              },
              {
                label: "Dưới mục tiêu",
                value: report?.summary.belowTarget ?? 0,
                icon: TrendingUp,
                tone: "bg-amber-50 text-amber-700",
              },
              {
                label: "Dưới giá vốn",
                value: report?.summary.belowCost ?? 0,
                icon: AlertTriangle,
                tone: "bg-red-50 text-red-700",
              },
              {
                label: "Giá vốn tăng",
                value: report?.summary.costIncrease ?? 0,
                icon: BarChart3,
                tone: "bg-orange-50 text-orange-700",
              },
              {
                label: "Thiếu giá vốn",
                value: report?.summary.missingCost ?? 0,
                icon: CircleDollarSign,
                tone: "bg-slate-100 text-slate-600",
              },
            ].map(({ label, value, icon: Icon, tone }) => (
              <article
                key={label}
                className="rounded-2xl border border-[#E9DED3] bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[#78866B]">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-[#211A16]">
                      {value}
                    </p>
                  </div>
                  <span className={`rounded-xl p-2.5 ${tone}`}>
                    <Icon size={20} />
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E9DED3] bg-white shadow-sm">
            <div className="grid gap-3 border-b border-[#EFE4DA] p-4 lg:grid-cols-[minmax(240px,1fr)_240px_240px]">
              <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E4D5C8] px-3">
                <Search size={18} className="text-[#94887E]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm tên món, size hoặc danh mục..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <select
                value={branchId}
                onChange={(event) => setBranchId(Number(event.target.value))}
                className="h-11 rounded-xl border border-[#E4D5C8] bg-white px-3 text-sm outline-none focus:border-[#C2763D]"
              >
                <option value={0}>Toàn chuỗi · giá vốn cao nhất</option>
                {branches
                  .filter((branch) => branch.isActive)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="h-11 rounded-xl border border-[#E4D5C8] bg-white px-3 text-sm outline-none focus:border-[#C2763D]"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ATTENTION">Chỉ món cần chú ý</option>
                <option value="HEALTHY">Đạt mục tiêu</option>
                <option value="BELOW_TARGET">Dưới mục tiêu</option>
                <option value="PRICE_BELOW_COST">Bán dưới giá vốn</option>
                <option value="COST_INCREASE">Giá vốn tăng</option>
                <option value="MISSING_COST">Thiếu giá vốn</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full text-left">
                <thead className="bg-[#FBF8F5] text-xs uppercase text-[#78866B]">
                  <tr>
                    <th className="px-4 py-3">Món / size</th>
                    <th className="px-4 py-3 text-right">Giá hiện tại</th>
                    <th className="px-4 py-3 text-right">Giá vốn</th>
                    <th className="px-4 py-3 text-right">Biên hiện tại</th>
                    <th className="px-4 py-3 text-right">Giá đề xuất</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Cơ sở tính</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE4DA]">
                  {visibleRecommendations.map((item) => {
                    const expanded = expandedVariantId === item.variantId;
                    const status = statusView[item.status];
                    return (
                      <Fragment key={item.variantId}>
                        <tr className="align-top hover:bg-[#FFFDFC]">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[#251D19]">
                              {item.productName} · Size {item.size}
                            </p>
                            <p className="mt-1 text-xs text-[#8A7D74]">
                              {item.category.name} · Bán{" "}
                              {number.format(item.last30DaysQuantity)} ly/30
                              ngày
                            </p>
                          </td>
                          <td className="px-4 py-4 text-right font-semibold">
                            {money(item.currentPrice)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <p className="font-semibold">
                              {item.status === "MISSING_COST"
                                ? "—"
                                : money(item.recipeCost)}
                            </p>
                            {item.hasEstimatedCost && (
                              <p className="mt-1 text-xs text-amber-700">
                                Có phần ước tính
                              </p>
                            )}
                          </td>
                          <td
                            className={`px-4 py-4 text-right font-semibold ${item.currentMarginPercent < 0 ? "text-red-600" : ""}`}
                          >
                            {number.format(item.currentMarginPercent)}%
                          </td>
                          <td className="px-4 py-4 text-right">
                            <p className="font-bold text-[#9E5525]">
                              {item.suggestedPrice === null
                                ? "—"
                                : money(item.suggestedPrice)}
                            </p>
                            {item.priceDifference !== null &&
                              item.priceDifference !== 0 && (
                                <p
                                  className={`mt-1 text-xs ${item.priceDifference > 0 ? "text-emerald-700" : "text-red-600"}`}
                                >
                                  {item.priceDifference > 0 ? "+" : ""}
                                  {money(item.priceDifference)}
                                </p>
                              )}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-[#62564E]">
                            <p>{item.costBasisBranch.code || "—"}</p>
                            {item.hasStockShortage && (
                              <p className="mt-1 text-xs text-red-600">
                                Kho đang thiếu
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedVariantId(
                                    expanded ? null : item.variantId,
                                  )
                                }
                                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E4D5C8] px-3 text-xs font-semibold text-[#5A4438]"
                              >
                                {expanded ? (
                                  <ChevronUp size={15} />
                                ) : (
                                  <ChevronDown size={15} />
                                )}{" "}
                                Chi tiết
                              </button>
                              <button
                                type="button"
                                disabled={item.status === "MISSING_COST"}
                                onClick={() => openApply(item)}
                                className="h-9 rounded-lg bg-[#4A2C20] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#C8BDB6]"
                              >
                                Áp dụng giá
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-[#FCF9F6]">
                            <td colSpan={8} className="p-4">
                              <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
                                <div className="rounded-xl border border-[#E9DED3] bg-white p-4">
                                  <h3 className="font-semibold text-[#2A211D]">
                                    Nguyên liệu tạo giá vốn
                                  </h3>
                                  <div className="mt-3 space-y-2">
                                    {item.ingredients.length ? (
                                      item.ingredients.map((ingredient) => (
                                        <div
                                          key={ingredient.ingredientId}
                                          className="grid grid-cols-[minmax(140px,1fr)_90px_110px_120px] items-center gap-2 border-b border-[#F0E7DF] py-2 text-sm last:border-0"
                                        >
                                          <div>
                                            <p className="font-medium">
                                              {ingredient.ingredientName}
                                            </p>
                                            {ingredient.isShort && (
                                              <p className="text-xs text-red-600">
                                                Thiếu tồn khả dụng
                                              </p>
                                            )}
                                          </div>
                                          <span>
                                            {number.format(ingredient.quantity)}{" "}
                                            {ingredientUnit(ingredient.unit)}
                                          </span>
                                          <span className="text-right">
                                            {ingredient.unitCost === null
                                              ? "Thiếu giá"
                                              : `${money(ingredient.unitCost)}/${ingredientUnit(ingredient.unit)}`}
                                          </span>
                                          <span className="text-right font-semibold">
                                            {money(ingredient.costAmount)}
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-sm text-[#8A7D74]">
                                        Size món này chưa có công thức nguyên
                                        liệu.
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-[#E9DED3] bg-white p-4">
                                  <h3 className="font-semibold text-[#2A211D]">
                                    Giá vốn theo chi nhánh
                                  </h3>
                                  <div className="mt-3 space-y-2">
                                    {item.branchCosts.map((branch) => (
                                      <div
                                        key={branch.branchId}
                                        className="flex items-center justify-between gap-3 rounded-lg bg-[#FBF8F5] px-3 py-2 text-sm"
                                      >
                                        <span>{branch.branchCode}</span>
                                        <span
                                          className={
                                            branch.missingCost
                                              ? "text-red-600"
                                              : "font-semibold"
                                          }
                                        >
                                          {branch.missingCost
                                            ? "Thiếu giá"
                                            : money(branch.recipeCost)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-[#E9DED3] bg-white p-4">
                                  <h3 className="font-semibold text-[#2A211D]">
                                    Mô phỏng theo 30 ngày
                                  </h3>
                                  <dl className="mt-3 space-y-3 text-sm">
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-[#7A6E66]">
                                        Số ly đã bán
                                      </dt>
                                      <dd className="font-semibold">
                                        {number.format(item.last30DaysQuantity)}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-[#7A6E66]">
                                        Lãi theo giá hiện tại
                                      </dt>
                                      <dd className="font-semibold">
                                        {money(
                                          item.estimatedMonthlyProfitCurrent,
                                        )}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                      <dt className="text-[#7A6E66]">
                                        Lãi theo giá đề xuất
                                      </dt>
                                      <dd className="font-semibold">
                                        {item.estimatedMonthlyProfitSuggested ===
                                        null
                                          ? "—"
                                          : money(
                                              item.estimatedMonthlyProfitSuggested,
                                            )}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between gap-3 border-t border-[#EFE4DA] pt-3">
                                      <dt className="font-medium">
                                        Chênh lệch dự kiến
                                      </dt>
                                      <dd
                                        className={`font-bold ${(item.estimatedMonthlyProfitDifference ?? 0) >= 0 ? "text-emerald-700" : "text-red-600"}`}
                                      >
                                        {item.estimatedMonthlyProfitDifference ===
                                        null
                                          ? "—"
                                          : money(
                                              item.estimatedMonthlyProfitDifference,
                                            )}
                                      </dd>
                                    </div>
                                  </dl>
                                  <p className="mt-3 text-xs leading-5 text-[#94887E]">
                                    Ước tính nếu sản lượng 30 ngày tới giữ
                                    nguyên, chưa tính thay đổi nhu cầu do đổi
                                    giá.
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {!loading && visibleRecommendations.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-16 text-center text-sm text-[#8A7D74]"
                      >
                        Không có món phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-16 text-center text-sm text-[#8A7D74]"
                      >
                        <LoaderCircle
                          size={22}
                          className="mx-auto mb-2 animate-spin"
                        />
                        Đang tính lại giá vốn...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E9DED3] bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-[#EFE4DA] p-5">
              <span className="rounded-xl bg-[#F4EEE8] p-2.5 text-[#8D5B3C]">
                <History size={20} />
              </span>
              <div>
                <h2 className="font-bold text-[#2A211D]">
                  Lịch sử thay đổi giá
                </h2>
                <p className="mt-1 text-sm text-[#84776E]">
                  Lưu người thay đổi, giá vốn tham chiếu và lý do để đối soát.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-[#FBF8F5] text-xs uppercase text-[#78866B]">
                  <tr>
                    <th className="px-5 py-3">Thời gian</th>
                    <th className="px-5 py-3">Món</th>
                    <th className="px-5 py-3">Thay đổi giá</th>
                    <th className="px-5 py-3">Giá vốn</th>
                    <th className="px-5 py-3">Người thực hiện</th>
                    <th className="px-5 py-3">Lý do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE4DA]">
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold">
                          {item.productName} · Size {item.size || "—"}
                        </p>
                        <p className="mt-1 text-xs text-[#8A7D74]">
                          {item.branch
                            ? `${item.branch.code} - ${item.branch.name}`
                            : "Toàn chuỗi"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span>{money(item.oldPrice)}</span>
                        <ArrowRight
                          className="mx-2 inline text-[#B46A39]"
                          size={15}
                        />
                        <strong>{money(item.newPrice)}</strong>
                      </td>
                      <td className="px-5 py-4">{money(item.recipeCost)}</td>
                      <td className="px-5 py-4">{item.actorName}</td>
                      <td className="max-w-xs px-5 py-4 text-[#6F625A]">
                        {item.reason || "—"}
                      </td>
                    </tr>
                  ))}
                  {!history.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-[#8A7D74]"
                      >
                        Chưa có lần thay đổi giá nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {applyTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Áp dụng giá bán mới"
        >
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#EFE4DA] p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C2763D]">
                  Xác nhận thay đổi giá
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[#251D19]">
                  {applyTarget.productName} · Size {applyTarget.size}
                </h2>
              </div>
              <button
                type="button"
                disabled={applying}
                onClick={() => setApplyTarget(null)}
                aria-label="Đóng"
                className="rounded-full p-2 text-[#7A6E66] hover:bg-[#F5EFE9]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#FBF8F5] p-3">
                  <p className="text-xs text-[#82756C]">Giá hiện tại</p>
                  <p className="mt-1 font-bold">
                    {money(applyTarget.currentPrice)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#FBF8F5] p-3">
                  <p className="text-xs text-[#82756C]">Giá vốn</p>
                  <p className="mt-1 font-bold">
                    {money(applyTarget.recipeCost)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#FBF8F5] p-3">
                  <p className="text-xs text-[#82756C]">Biên mục tiêu</p>
                  <p className="mt-1 font-bold">
                    {number.format(report?.settings.targetMarginPercent ?? 0)}%
                  </p>
                </div>
              </div>
              <label className="block text-sm font-semibold text-[#4D4038]">
                Giá bán mới *
                <input
                  type="number"
                  min={1000}
                  step={settings?.roundingStep ?? 1000}
                  value={newPrice}
                  onChange={(event) => setNewPrice(event.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-[#E1CDBD] px-4 text-lg font-bold outline-none focus:border-[#C2763D]"
                />
              </label>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span>Biên lợi nhuận sau đổi</span>
                  <strong
                    className={
                      proposedMargin >=
                      (report?.settings.targetMarginPercent ?? 0)
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }
                  >
                    {number.format(proposedMargin)}%
                  </strong>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <span>
                    Tác động theo{" "}
                    {number.format(applyTarget.last30DaysQuantity)} ly/30 ngày
                  </span>
                  <strong
                    className={
                      proposedMonthlyDifference >= 0
                        ? "text-emerald-700"
                        : "text-red-600"
                    }
                  >
                    {proposedMonthlyDifference > 0 ? "+" : ""}
                    {money(proposedMonthlyDifference)}
                  </strong>
                </div>
              </div>
              <label className="block text-sm font-semibold text-[#4D4038]">
                Lý do thay đổi *
                <textarea
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-2 w-full resize-none rounded-xl border border-[#E1CDBD] p-3 font-normal outline-none focus:border-[#C2763D]"
                />
              </label>
              <p className="text-xs leading-5 text-[#8A7D74]">
                Giá được áp dụng ngay cho size món này và lưu vĩnh viễn trong
                lịch sử. Giá gốc của món sẽ đồng bộ theo size có giá thấp nhất.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#EFE4DA] p-5">
              <button
                type="button"
                disabled={applying}
                onClick={() => setApplyTarget(null)}
                className="h-11 rounded-xl border border-[#E1D4C8] px-5 font-semibold text-[#5F5148]"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={applying}
                onClick={() => void confirmApply()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-5 font-semibold text-white disabled:opacity-50"
              >
                {applying && (
                  <LoaderCircle size={18} className="animate-spin" />
                )}{" "}
                Xác nhận áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
