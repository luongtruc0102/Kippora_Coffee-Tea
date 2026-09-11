import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CirclePause,
  Store,
} from "lucide-react";
import Link from "next/link";

import type { BranchHealth, DashboardPeriod } from "@/types/dashboard";

type Props = {
  data: BranchHealth[];
  period: DashboardPeriod;
};

const periodLabels: Record<DashboardPeriod, string> = {
  "7D": "7 ngày gần đây",
  "30D": "30 ngày gần đây",
  "1Y": "12 tháng gần đây",
  CUSTOM: "khoảng ngày đã chọn",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

const healthView = {
  HEALTHY: {
    label: "Ổn định",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700",
  },
  ATTENTION: {
    label: "Cần chú ý",
    icon: AlertTriangle,
    className: "bg-amber-50 text-amber-700",
  },
  PAUSED: {
    label: "Tạm ngưng",
    icon: CirclePause,
    className: "bg-slate-100 text-slate-600",
  },
} as const;

export default function BranchHealthTable({ data, period }: Props) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[#EEE5DC] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-[#2A211D]">
            Sức khỏe chi nhánh
          </h3>
          <p className="mt-1 text-sm text-[#78866B]">
            So sánh kinh doanh và vận hành trong {periodLabels[period]}.
          </p>
        </div>
        <Link
          href="/admin/branches"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#9F642F] hover:underline"
        >
          Quản lý chi nhánh <ArrowRight size={15} />
        </Link>
      </div>

      {data.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-[#FAF8F5] text-[11px] uppercase tracking-wide text-[#78866B]">
              <tr>
                <th className="px-5 py-4">Chi nhánh</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4 text-right">Doanh thu</th>
                <th className="px-4 py-4 text-center">Đơn hàng</th>
                <th className="px-4 py-4 text-center">Nhân sự</th>
                <th className="px-4 py-4 text-center">Ca hôm nay</th>
                <th className="px-4 py-4 text-center">Kho sắp hết</th>
                <th className="px-4 py-4 text-right">Tỷ lệ hủy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEE5DC]">
              {data.map((branch) => {
                const health = healthView[branch.health];
                const HealthIcon = health.icon;
                return (
                  <tr key={branch.id} className="text-[#4F4741]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#9F642F]">
                          <Store size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-[#2A211D]">
                            {branch.code} · {branch.name}
                          </p>
                          <p className="mt-0.5 text-xs text-[#8A817B]">
                            {branch.managerName
                              ? `Trưởng: ${branch.managerName}`
                              : "Chưa có trưởng chi nhánh"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${health.className}`}
                      >
                        <HealthIcon size={14} /> {health.label}
                      </span>
                      <p className="mt-1.5 whitespace-nowrap text-[11px] text-[#8A817B]">
                        {!branch.isActive
                          ? "Chi nhánh đã khóa"
                          : branch.isAcceptingOrders
                            ? "Đang nhận đơn"
                            : "Đang tạm ngưng nhận đơn"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-bold text-[#2A211D]">
                        {formatCurrency(branch.revenue)}
                      </p>
                      <p className="mt-1 text-xs text-[#8A817B]">
                        TB {formatCurrency(branch.averageOrderValue)}/đơn
                      </p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <p className="font-bold text-[#2A211D]">
                        {branch.completedOrders}/{branch.periodOrders}
                      </p>
                      <p className="mt-1 text-xs text-[#8A817B]">
                        {branch.activeOrders} đang xử lý
                      </p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <p className="font-bold text-[#2A211D]">
                        {branch.staffOnDuty}/{branch.activeStaff}
                      </p>
                      <p className="mt-1 text-xs text-[#8A817B]">
                        đang làm/hoạt động
                      </p>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-[#2A211D]">
                      {branch.todayShifts}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 text-xs font-bold ${
                          branch.lowStockItems
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {branch.lowStockItems}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span
                        className={
                          branch.cancellationRate >= 20
                            ? "font-bold text-red-600"
                            : "font-semibold text-[#2A211D]"
                        }
                      >
                        {branch.cancellationRate.toFixed(1)}%
                      </span>
                      <p className="mt-1 text-xs text-[#8A817B]">
                        {branch.cancelledOrders} đơn hủy
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-16 text-center text-sm text-[#8A817B]">
          Không có chi nhánh phù hợp với bộ lọc.
        </div>
      )}
    </section>
  );
}
