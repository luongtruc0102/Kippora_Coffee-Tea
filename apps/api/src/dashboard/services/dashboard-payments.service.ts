import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardPeriod } from '../dashboard.types';
import { getDashboardPeriodRange } from '../utils/dashboard-period.util';

@Injectable()
export class DashboardPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Thống kê thanh toán theo trạng thái và phương thức
  async getPaymentStatistics(
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);

    const [statusStats, methodStats] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['status'],

        where: {
          ...(branchId ? { order: { branchId } } : {}),
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },

        _count: {
          _all: true,
        },

        _sum: {
          amount: true,
        },
      }),

      this.prisma.payment.groupBy({
        by: ['method'],

        where: {
          ...(branchId ? { order: { branchId } } : {}),
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },

        _count: {
          _all: true,
        },

        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      byStatus: statusStats.map((item) => ({
        status: item.status,
        count: item._count._all,
        amount: Number(item._sum.amount ?? 0),
      })),

      byMethod: methodStats.map((item) => ({
        method: item.method,
        count: item._count._all,
        amount: Number(item._sum.amount ?? 0),
      })),
    };
  }
}
