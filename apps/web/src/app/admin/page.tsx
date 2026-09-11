"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  CalendarRange,
  CircleDollarSign,
  Coffee,
  HandCoins,
  PackagePlus,
  ReceiptText,
  ShoppingBag,
  Users,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

import StatCard from "@/components/admin/stat-card";
import RevenueChart from "@/components/admin/revenue-chart";
import OrderStatusChart from "@/components/admin/order-status-chart";
import TopProductsChart from "@/components/admin/top-products-chart";
import RecentOrders from "@/components/admin/recent-orders";
import TopToppingsChart from "@/components/admin/top-toppings-chart";
import PaymentStatisticsCard from "@/components/admin/payment-statistics";
import VoucherStatisticsCard from "@/components/admin/voucher-statistics";
import TopCustomers from "@/components/admin/top-customers";
import BranchRevenueChart from "@/components/admin/branch-revenue-chart";
import OperationsCenter from "@/components/admin/operations-center";
import BranchHealthTable from "@/components/admin/branch-health-table";

import ToastMessage from "@/components/ui/toast-message";

import {
  getDashboardOverview,
  getRevenue,
  getOrderStatusStatistics,
  getTopProducts,
  getRecentOrders,
  getTopToppings,
  getPaymentStatistics,
  getVoucherStatistics,
  getTopCustomers,
  getBranchRevenue,
  getDashboardOperations,
  getBranchHealth,
} from "@/services/dashboard.service";
import { getBranches } from "@/services/store-settings.service";

import type {
  DashboardOverview,
  DashboardPeriod,
  DashboardDateRange,
  RevenueStatistic,
  OrderStatusStatistic,
  TopProduct,
  RecentOrder,
  TopTopping,
  PaymentStatistics,
  VoucherStatistics,
  TopCustomer,
  BranchRevenueStatistic,
  DashboardOperations,
  BranchHealth,
} from "@/types/dashboard";
import type { BranchStatus } from "@/types/store-settings";

const periodOptions: {
  label: string;
  value: DashboardPeriod;
}[] = [
  {
    label: "7 ngày",
    value: "7D",
  },
  {
    label: "1 tháng",
    value: "30D",
  },
  {
    label: "1 năm",
    value: "1Y",
  },
  {
    label: "Tùy chọn",
    value: "CUSTOM",
  },
];

const periodLabels: Record<DashboardPeriod, string> = {
  "7D": "7 ngày",
  "30D": "30 ngày",
  "1Y": "1 năm",
  CUSTOM: "khoảng ngày đã chọn",
};

function dateInputValue(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function defaultCustomRange(): DashboardDateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return { from: dateInputValue(from), to: dateInputValue(to) };
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [period, setPeriod] = useState<DashboardPeriod>("7D");

  const [customRangeDraft, setCustomRangeDraft] =
    useState<DashboardDateRange>(defaultCustomRange);
  const [appliedCustomRange, setAppliedCustomRange] =
    useState<DashboardDateRange>(defaultCustomRange);

  const [branchId, setBranchId] = useState(0);

  const [branches, setBranches] = useState<BranchStatus[]>([]);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  const overviewLoadedRef =
    useRef(false);

  const [revenueData, setRevenueData] = useState<RevenueStatistic[]>([]);

  const [orderStatusData, setOrderStatusData] = useState<
    OrderStatusStatistic[]
  >([]);

  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  const [topToppings, setTopToppings] = useState<TopTopping[]>([]);

  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);

  const [paymentStatistics, setPaymentStatistics] =
    useState<PaymentStatistics | null>(null);

  const [voucherStatistics, setVoucherStatistics] =
    useState<VoucherStatistics | null>(null);

  const [branchRevenue, setBranchRevenue] = useState<
    BranchRevenueStatistic[]
  >([]);

  const [operations, setOperations] = useState<DashboardOperations | null>(
    null,
  );

  const [branchHealth, setBranchHealth] = useState<BranchHealth[]>([]);

  const dashboardDateRange =
    period === "CUSTOM" ? appliedCustomRange : undefined;

  useEffect(() => {
    async function loadDashboard() {
      try {
        setError("");

        // Chỉ hiện loading toàn trang ở lần tải đầu tiên
        if (!overviewLoadedRef.current) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        const accessToken = sessionStorage.getItem("accessToken");

        if (!accessToken) {
          setError("Không tìm thấy phiên đăng nhập.");
          return;
        }

        const [
          overviewData,
          revenue,
          orderStatuses,
          products,
          orders,
          toppings,
          payments,
          vouchers,
          branchRevenueData,
          bestCustomers,
          operationsData,
          branchesData,
          branchHealthData,
        ] = await Promise.all([
          getDashboardOverview(accessToken, period, branchId || undefined, dashboardDateRange),
          getRevenue(accessToken, period, branchId || undefined, dashboardDateRange),
          getOrderStatusStatistics(accessToken, period, branchId || undefined, dashboardDateRange),
          getTopProducts(accessToken, 5, period, branchId || undefined, dashboardDateRange),
          getRecentOrders(accessToken, 5, period, branchId || undefined, dashboardDateRange),
          getTopToppings(accessToken, 5, period, branchId || undefined, dashboardDateRange),
          getPaymentStatistics(accessToken, period, branchId || undefined, dashboardDateRange),
          getVoucherStatistics(accessToken, 5, period, branchId || undefined, dashboardDateRange),
          getBranchRevenue(accessToken, period, branchId || undefined, dashboardDateRange),
          getTopCustomers(accessToken, 5, period, branchId || undefined, dashboardDateRange),
          getDashboardOperations(accessToken, branchId || undefined),
          getBranches(accessToken),
          getBranchHealth(accessToken, period, branchId || undefined, dashboardDateRange),
        ]);

        setOverview(overviewData);
        overviewLoadedRef.current = true;
        setRevenueData(revenue);
        setOrderStatusData(orderStatuses);
        setTopProducts(products);
        setRecentOrders(orders);
        setTopToppings(toppings);
        setPaymentStatistics(payments);
        setVoucherStatistics(vouchers);
        setTopCustomers(bestCustomers);
        setBranchRevenue(branchRevenueData);
        setOperations(operationsData);
        setBranches(branchesData);
        setBranchHealth(branchHealthData);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Không thể tải dashboard",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }

    loadDashboard();
  }, [branchId, dashboardDateRange, period]);

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  }

  const currentPeriodLabel =
    period === "CUSTOM"
      ? `${displayDate(appliedCustomRange.from)} – ${displayDate(appliedCustomRange.to)}`
      : periodLabels[period];
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const scopeLabel = selectedBranch
    ? `${selectedBranch.code} · ${selectedBranch.name}`
    : "Toàn hệ thống";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#1F1B18]">Dashboard</h2>

          <p className="mt-1 text-[#78866B]">
            Tổng quan hoạt động của Kippora.
          </p>
        </div>
        {refreshing && (
          <span className="text-sm text-[#8A817B]">Đang cập nhật dữ liệu...</span>
        )}
      </div>

      <section className="sticky top-20 z-20 rounded-2xl border border-[#E9E1D8] bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <label className="block min-w-0 flex-1 xl:max-w-sm">
            <span className="mb-1.5 block text-xs font-semibold text-[#78866B]">
              Phạm vi chi nhánh
            </span>
            <select
              value={branchId}
              disabled={refreshing}
              onChange={(event) => setBranchId(Number(event.target.value))}
              className="h-11 w-full rounded-xl border border-[#DCCFC3] bg-white px-3 text-sm font-semibold text-[#2A211D] outline-none transition focus:border-[#C9894B] disabled:cursor-wait disabled:opacity-70"
            >
              <option value={0}>Toàn hệ thống</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                  {!branch.isActive ? " · Đã khóa" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="min-w-0">
            <p className="mb-1.5 text-xs font-semibold text-[#78866B]">
              Khoảng thời gian
            </p>
            <div className="flex rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] p-1">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={refreshing}
                  onClick={() => {
                    if (period !== option.value) setPeriod(option.value);
                  }}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${
                    period === option.value
                      ? "bg-[#4A2C20] text-white shadow-sm"
                      : "text-[#6B625C] hover:bg-white"
                  } ${refreshing ? "cursor-wait opacity-70" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {period === "CUSTOM" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#78866B]">
                    Từ ngày
                  </span>
                  <input
                    type="date"
                    value={customRangeDraft.from}
                    max={customRangeDraft.to}
                    disabled={refreshing}
                    onChange={(event) =>
                      setCustomRangeDraft((current) => ({
                        ...current,
                        from: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-[#DCCFC3] bg-white px-3 text-sm text-[#2A211D] outline-none focus:border-[#C9894B]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#78866B]">
                    Đến ngày
                  </span>
                  <input
                    type="date"
                    value={customRangeDraft.to}
                    min={customRangeDraft.from}
                    max={dateInputValue(new Date())}
                    disabled={refreshing}
                    onChange={(event) =>
                      setCustomRangeDraft((current) => ({
                        ...current,
                        to: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-[#DCCFC3] bg-white px-3 text-sm text-[#2A211D] outline-none focus:border-[#C9894B]"
                  />
                </label>
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => {
                    if (!customRangeDraft.from || !customRangeDraft.to) {
                      setError("Vui lòng chọn đầy đủ khoảng ngày.");
                      return;
                    }
                    if (customRangeDraft.from > customRangeDraft.to) {
                      setError("Ngày bắt đầu không được sau ngày kết thúc.");
                      return;
                    }
                    setError("");
                    setAppliedCustomRange({ ...customRangeDraft });
                  }}
                  className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white transition hover:bg-[#5A3728] disabled:cursor-wait disabled:opacity-70"
                >
                  <CalendarRange size={17} /> Áp dụng
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-[#9A9089]">
          Toàn bộ số liệu bên dưới đang áp dụng cho: {scopeLabel} · {currentPeriodLabel}.
        </p>
      </section>

      <ToastMessage message={error} />

      {loading && !overview ? (
        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-6 text-sm text-[#78866B] shadow-sm">
          Đang tải dữ liệu dashboard...
        </div>
      ) : (
        overview && (
          <>
            {operations && (
              <OperationsCenter data={operations} scopeLabel={scopeLabel} />
            )}

            <BranchHealthTable data={branchHealth} period={period} />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title={`Doanh thu ${currentPeriodLabel}`}
                value={formatCurrency(overview.periodRevenue)}
                description="Doanh thu từ đơn hoàn thành"
                icon={CircleDollarSign}
                trend={{ value: overview.comparison.revenueChangePercent }}
              />

              <StatCard
                title="Tổng doanh thu"
                value={formatCurrency(overview.totalRevenue)}
                description={`Tổng doanh thu của ${scopeLabel.toLocaleLowerCase("vi-VN")}`}
                icon={ReceiptText}
              />

              <StatCard
                title={`Đơn hàng ${currentPeriodLabel}`}
                value={overview.periodOrders}
                description="Số đơn được tạo trong khoảng thời gian"
                icon={ShoppingBag}
                trend={{ value: overview.comparison.orderChangePercent }}
              />

              <StatCard
                title={`Khách mới ${currentPeriodLabel}`}
                value={overview.newCustomers}
                description="Tài khoản khách hàng mới"
                icon={Users}
                trend={{ value: overview.comparison.newCustomerChangePercent }}
              />

              <StatCard
                title="Sản phẩm đang bán"
                value={overview.activeProducts}
                description="Sản phẩm đang hoạt động"
                icon={Coffee}
              />

              <StatCard
                title="Chi nhánh hoạt động"
                value={`${overview.activeBranches} / ${overview.totalBranches}`}
                description={`Số chi nhánh đang hoạt động trong ${scopeLabel.toLocaleLowerCase("vi-VN")}`}
                icon={Building2}
              />

              <StatCard
                title="Giá trị đơn trung bình"
                value={formatCurrency(overview.averageOrderValue)}
                description={`Trung bình trên mỗi đơn hoàn thành trong ${currentPeriodLabel}`}
                icon={CircleDollarSign}
                trend={{
                  value: overview.comparison.averageOrderValueChangePercent,
                }}
              />

              <StatCard
                title="Tỷ lệ hủy đơn"
                value={`${overview.cancellationRate.toFixed(1)}%`}
                description={`Tỷ lệ đơn bị hủy trong ${currentPeriodLabel}`}
                icon={XCircle}
                trend={{
                  value: overview.comparison.cancellationRateChangePoints,
                  inverse: true,
                  unit: " điểm %",
                }}
              />
            </div>

            <section>
              <div className="mb-3">
                <h3 className="text-xl font-bold text-[#2A211D]">
                  Chi phí và lợi nhuận tạm tính
                </h3>
                <p className="mt-1 text-sm text-[#78866B]">
                  Chỉ gồm khoản chi đã duyệt, phiếu nhập kho hoàn tất và lương
                  ước tính từ giờ chấm công trong {currentPeriodLabel}.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Chi phí vận hành"
                  value={formatCurrency(
                    overview.financials.approvedOperatingExpenses,
                  )}
                  description="Các khoản chi đã được Admin duyệt"
                  icon={HandCoins}
                />
                <StatCard
                  title="Chi nhập nguyên liệu"
                  value={formatCurrency(overview.financials.inventoryPurchases)}
                  description="Tổng phiếu nhập kho đã hoàn tất"
                  icon={PackagePlus}
                />
                <StatCard
                  title="Lương ước tính"
                  value={formatCurrency(overview.financials.estimatedLaborCost)}
                  description="Theo giờ chấm công và hệ số tăng ca"
                  icon={UserRoundCheck}
                />
                <StatCard
                  title="Lợi nhuận tạm tính"
                  value={formatCurrency(overview.financials.estimatedProfit)}
                  valueClassName={
                    overview.financials.estimatedProfit >= 0
                      ? "text-emerald-700"
                      : "text-red-600"
                  }
                  description={`${overview.financials.estimatedProfitMargin.toFixed(1)}% doanh thu · Tổng chi ${formatCurrency(overview.financials.totalEstimatedCost)}`}
                  icon={CircleDollarSign}
                />
              </div>
            </section>

            {/* Hiệu suất kinh doanh */}
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <RevenueChart data={revenueData} />
              </div>

              <OrderStatusChart data={orderStatusData} />
            </div>

            {/* So sánh chi nhánh và khách hàng giá trị cao */}
            <div className="grid gap-6 xl:grid-cols-3">
              <TopCustomers data={topCustomers} />

              <div className="min-w-0 xl:col-span-2">
                <BranchRevenueChart data={branchRevenue} />
              </div>
            </div>

            {/* Hiệu suất sản phẩm */}
            <div className="grid gap-6 xl:grid-cols-2">
              <TopProductsChart data={topProducts} />

              <TopToppingsChart data={topToppings} />
            </div>

            {/* Thanh toán và voucher */}
            {paymentStatistics && voucherStatistics && (
              <div className="grid gap-6 xl:grid-cols-2">
                <PaymentStatisticsCard data={paymentStatistics} />

                <VoucherStatisticsCard data={voucherStatistics} />
              </div>
            )}

            {/* Chi tiết vận hành */}
            <RecentOrders data={recentOrders} />
          </>
        )
      )}
    </div>
  );
}
