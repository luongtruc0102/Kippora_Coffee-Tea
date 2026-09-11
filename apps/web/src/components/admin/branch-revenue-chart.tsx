'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { BranchRevenueStatistic } from '@/types/dashboard';

type Props = {
  data: BranchRevenueStatistic[];
};

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export default function BranchRevenueChart({ data }: Props) {
  const chartData = data.map((item) => ({
    ...item,
    label: `${item.branchCode} · ${item.branchName}`,
  }));

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = data.reduce(
    (sum, item) => sum + item.completedOrders,
    0,
  );

  return (
    <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#1F1B18]">
            Doanh thu theo chi nhánh
          </h3>

          <p className="mt-1 text-sm text-[#78866B]">
            So sánh doanh thu từ các đơn đã hoàn thành
          </p>
        </div>

        <div className="flex gap-6">
          <div>
            <p className="text-xs text-[#8A817B]">Tổng doanh thu</p>
            <p className="mt-1 text-base font-semibold text-[#C9894B]">
              {currencyFormatter.format(totalRevenue)}
            </p>
          </div>

          <div>
            <p className="text-xs text-[#8A817B]">Đơn hoàn thành</p>
            <p className="mt-1 text-base font-semibold text-[#6F8C63]">
              {totalOrders}
            </p>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-[#DED5CC] text-sm text-[#8A817B]">
          Chưa có chi nhánh để so sánh.
        </div>
      ) : (
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 28, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />

              <XAxis
                type="number"
                tickFormatter={(value) =>
                  `${compactCurrencyFormatter.format(Number(value))}đ`
                }
                tick={{ fontSize: 12 }}
              />

              <YAxis
                type="category"
                dataKey="label"
                width={145}
                tick={{ fontSize: 12 }}
              />

              <Tooltip
                formatter={(value) => [
                  currencyFormatter.format(Number(value)),
                  'Doanh thu',
                ]}
              />

              <Bar
                dataKey="revenue"
                name="Doanh thu"
                fill="#C9894B"
                radius={[0, 8, 8, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 border-t border-[#F0E8E0] pt-4 text-sm text-[#78866B]">
        Hiển thị {data.length} chi nhánh, bao gồm cả chi nhánh chưa phát sinh
        doanh thu.
      </div>
    </div>
  );
}
