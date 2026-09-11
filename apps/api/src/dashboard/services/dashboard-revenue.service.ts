import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardPeriod } from '../dashboard.types';
import { getDashboardPeriodRange } from '../utils/dashboard-period.util';

const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const vietnamMonthFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
});

@Injectable()
export class DashboardRevenueService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy doanh thu theo khoảng thời gian của Dashboard
  async getRevenue(
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const { startDate, endDate, dayCount } = getDashboardPeriodRange(
      period,
      from,
      to,
    );

    if (period === '1Y' || dayCount > 62) {
      return this.getRevenueByMonth(startDate, endDate, branchId);
    }

    return this.getRevenueByDay(startDate, endDate, branchId);
  }

  // So sánh doanh thu thực nhận từ đơn hoàn thành giữa tất cả chi nhánh.
  // Giữ cả chi nhánh chưa có doanh thu để báo cáo không làm mất dữ liệu đối chiếu.
  async getBranchRevenue(
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);

    const [branches, statistics] = await Promise.all([
      this.prisma.storeBranch.findMany({
        where: branchId ? { id: branchId } : undefined,
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.order.groupBy({
        by: ['branchId'],
        where: {
          ...(branchId ? { branchId } : {}),
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { totalPrice: true },
        _count: { _all: true },
      }),
    ]);

    const statisticByBranch = new Map(
      statistics.map((item) => [item.branchId, item]),
    );

    return branches.map((branch) => {
      const statistic = statisticByBranch.get(branch.id);

      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        isActive: branch.isActive,
        revenue: Number(statistic?._sum.totalPrice ?? 0),
        completedOrders: statistic?._count._all ?? 0,
      };
    });
  }

  // Hiệu suất kinh doanh theo ngày
  private async getRevenueByDay(
    startDate: Date,
    endDate: Date,
    branchId?: number,
  ) {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        status: 'COMPLETED',

        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },

      select: {
        totalPrice: true,
        createdAt: true,
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

    const statisticsMap = new Map<
      string,
      {
        revenue: number;
        completedOrders: number;
      }
    >();

    // Tạo đủ các ngày kể cả ngày không có đơn
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const key = vietnamDateFormatter.format(currentDate);

      statisticsMap.set(key, {
        revenue: 0,
        completedOrders: 0,
      });

      currentDate.setTime(currentDate.getTime() + 86_400_000);
    }

    // Tổng hợp doanh thu và số đơn hoàn thành
    for (const order of orders) {
      const key = vietnamDateFormatter.format(order.createdAt);

      const current = statisticsMap.get(key);

      if (!current) {
        continue;
      }

      current.revenue += Number(order.totalPrice);

      current.completedOrders += 1;
    }

    return Array.from(statisticsMap.entries()).map(([date, statistic]) => ({
      date,

      revenue: statistic.revenue,

      completedOrders: statistic.completedOrders,

      averageOrderValue:
        statistic.completedOrders > 0
          ? statistic.revenue / statistic.completedOrders
          : 0,
    }));
  }

  // Hiệu suất kinh doanh theo tháng
  private async getRevenueByMonth(
    startDate: Date,
    endDate: Date,
    branchId?: number,
  ) {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        status: 'COMPLETED',

        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },

      select: {
        totalPrice: true,
        createdAt: true,
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

    const statisticsMap = new Map<
      string,
      {
        revenue: number;
        completedOrders: number;
      }
    >();

    // Tạo đủ các tháng kể cả tháng không có đơn.
    const [startYear, startMonth] = vietnamMonthFormatter
      .format(startDate)
      .split('-')
      .map(Number);
    const [endYear, endMonth] = vietnamMonthFormatter
      .format(endDate)
      .split('-')
      .map(Number);
    const firstMonthIndex = startYear * 12 + startMonth - 1;
    const lastMonthIndex = endYear * 12 + endMonth - 1;

    for (let monthIndex = firstMonthIndex; monthIndex <= lastMonthIndex; monthIndex++) {
      const year = Math.floor(monthIndex / 12);
      const month = (monthIndex % 12) + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;

      statisticsMap.set(key, {
        revenue: 0,
        completedOrders: 0,
      });
    }

    // Tổng hợp doanh thu và số đơn theo tháng
    for (const order of orders) {
      const key = vietnamMonthFormatter.format(order.createdAt);

      const current = statisticsMap.get(key);

      if (!current) {
        continue;
      }

      current.revenue += Number(order.totalPrice);

      current.completedOrders += 1;
    }

    return Array.from(statisticsMap.entries()).map(([month, statistic]) => ({
      month,

      revenue: statistic.revenue,

      completedOrders: statistic.completedOrders,

      averageOrderValue:
        statistic.completedOrders > 0
          ? statistic.revenue / statistic.completedOrders
          : 0,
    }));
  }
}
