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
export class DashboardCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // KHÁCH HÀNG MỚI
  // =========================

  // Thống kê khách hàng mới theo khoảng thời gian
  async getNewCustomers(
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

    const users = await this.prisma.user.findMany({
      where: {
        role: {
          name: 'USER',
        },

        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(branchId ? { orders: { some: { branchId } } } : {}),
      },

      select: {
        createdAt: true,
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

    // Với 1 năm, nhóm theo tháng để tránh trả về 365 điểm dữ liệu
    if (period === '1Y' || dayCount > 62) {
      return this.groupCustomersByMonth(users, startDate, endDate);
    }

    // 7 ngày và 30 ngày hiển thị theo ngày
    return this.groupCustomersByDay(users, startDate, endDate);
  }

  // =========================
  // TOP KHÁCH HÀNG
  // =========================

  // Top khách hàng chi tiêu nhiều nhất trong khoảng thời gian
  async getTopCustomers(
    limit = 5,
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);

    const customers = await this.prisma.order.groupBy({
      by: ['userId'],

      // Chỉ tính đơn hoàn thành trong khoảng thời gian đã chọn
      where: {
        ...(branchId ? { branchId } : {}),
        status: 'COMPLETED',
        user: { role: { name: 'USER' } },

        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },

      _sum: {
        totalPrice: true,
      },

      _count: {
        id: true,
      },

      orderBy: {
        _sum: {
          totalPrice: 'desc',
        },
      },

      take: safeLimit,
    });

    const userIds = customers.map((customer) => customer.userId);

    if (userIds.length === 0) {
      return [];
    }

    // Lấy thông tin của các khách hàng đã lọc
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },

      select: {
        id: true,
        email: true,
        profile: { select: { fullName: true } },
      },
    });

    const userMap = new Map(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          email: user.email,
          fullName: user.profile?.fullName ?? null,
        },
      ]),
    );

    return customers.map((customer) => ({
      userId: customer.userId,

      customer: userMap.get(customer.userId) ?? null,

      totalOrders: customer._count.id,

      totalSpent: Number(customer._sum.totalPrice ?? 0),
    }));
  }

  // =========================
  // HELPER
  // =========================

  // Nhóm khách hàng theo ngày cho 7D và 30D
  private groupCustomersByDay(
    users: { createdAt: Date }[],
    startDate: Date,
    endDate: Date,
  ) {
    const customerMap = new Map<string, number>();

    const current = new Date(startDate);

    while (current <= endDate) {
      const key = vietnamDateFormatter.format(current);

      customerMap.set(key, 0);

      current.setTime(current.getTime() + 86_400_000);
    }

    for (const user of users) {
      const key = vietnamDateFormatter.format(user.createdAt);

      customerMap.set(key, (customerMap.get(key) ?? 0) + 1);
    }

    return Array.from(customerMap.entries()).map(([date, newCustomers]) => ({
      date,
      newCustomers,
    }));
  }

  // Nhóm khách hàng theo tháng khi xem 1 năm
  private groupCustomersByMonth(
    users: { createdAt: Date }[],
    startDate: Date,
    endDate: Date,
  ) {
    const customerMap = new Map<string, number>();

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

    for (
      let monthIndex = firstMonthIndex;
      monthIndex <= lastMonthIndex;
      monthIndex++
    ) {
      const year = Math.floor(monthIndex / 12);
      const month = (monthIndex % 12) + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;

      customerMap.set(key, 0);
    }

    for (const user of users) {
      const key = vietnamMonthFormatter.format(user.createdAt);

      customerMap.set(key, (customerMap.get(key) ?? 0) + 1);
    }

    return Array.from(customerMap.entries()).map(([date, newCustomers]) => ({
      date,
      newCustomers,
    }));
  }

  // =========================
  // KHÁCH HÀNG QUAY LẠI
  // =========================

  // Thống kê khách mới và khách quay lại theo khoảng thời gian
  async getCustomerRetention(
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);

    // Lấy các khách có ít nhất 1 đơn hoàn thành trong kỳ
    const customersInPeriod = await this.prisma.order.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        status: 'COMPLETED',
        user: { role: { name: 'USER' } },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },

      select: {
        userId: true,
      },

      distinct: ['userId'],
    });

    const userIds = customersInPeriod.map((order) => order.userId);

    if (userIds.length === 0) {
      return {
        period,
        totalCustomers: 0,
        newCustomers: 0,
        returningCustomers: 0,
        newCustomerRate: 0,
        returningCustomerRate: 0,
      };
    }

    // Tìm những khách đã từng mua trước khoảng thời gian hiện tại
    const previousCustomers = await this.prisma.order.groupBy({
      by: ['userId'],

      where: {
        userId: {
          in: userIds,
        },

        status: 'COMPLETED',
        ...(branchId ? { branchId } : {}),
        user: { role: { name: 'USER' } },

        createdAt: {
          lt: startDate,
        },
      },
    });

    const returningCustomerIds = new Set(
      previousCustomers.map((customer) => customer.userId),
    );

    const totalCustomers = userIds.length;

    const returningCustomers = returningCustomerIds.size;

    const newCustomers = totalCustomers - returningCustomers;

    const newCustomerRate =
      totalCustomers > 0 ? (newCustomers / totalCustomers) * 100 : 0;

    const returningCustomerRate =
      totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

    return {
      period,
      totalCustomers,
      newCustomers,
      returningCustomers,

      newCustomerRate: Number(newCustomerRate.toFixed(1)),

      returningCustomerRate: Number(returningCustomerRate.toFixed(1)),
    };
  }
}
