import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardPeriod } from '../dashboard.types';
import { getDashboardPeriodRange } from '../utils/dashboard-period.util';

@Injectable()
export class DashboardVouchersService {
  constructor(private readonly prisma: PrismaService) {}

  // Thống kê voucher theo khoảng thời gian của Dashboard
  async getVoucherStatistics(
    limit = 5,
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);

    const now = new Date();

    const [voucherUsage, totalDiscount, activeVouchers] = await Promise.all([
      // Đếm số lần voucher được sử dụng trong khoảng thời gian
      this.prisma.order.groupBy({
        by: ['voucherId'],

        where: {
          ...(branchId ? { branchId } : {}),
          voucherId: {
            not: null,
          },

          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },

        _count: {
          id: true,
        },

        orderBy: {
          _count: {
            id: 'desc',
          },
        },

        take: safeLimit,
      }),

      // Tổng tiền đã giảm trong khoảng thời gian
      this.prisma.order.aggregate({
        where: {
          ...(branchId ? { branchId } : {}),
          voucherId: {
            not: null,
          },

          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },

        _sum: {
          discountAmount: true,
        },
      }),

      // Voucher đang hoạt động ở thời điểm hiện tại
      this.prisma.voucher.count({
        where: {
          isActive: true,

          startAt: {
            lte: now,
          },

          endAt: {
            gte: now,
          },
        },
      }),
    ]);

    const voucherIds = voucherUsage
      .map((item) => item.voucherId)
      .filter((voucherId): voucherId is number => voucherId !== null);

    // Lấy thông tin chi tiết của các voucher trong top
    const vouchers =
      voucherIds.length > 0
        ? await this.prisma.voucher.findMany({
            where: {
              id: {
                in: voucherIds,
              },
            },

            select: {
              id: true,
              code: true,
              description: true,
              usedCount: true,
              usageLimit: true,
              endAt: true,
              isActive: true,
            },
          })
        : [];

    const voucherMap = new Map(
      vouchers.map((voucher) => [voucher.id, voucher]),
    );

    const topVouchers = voucherUsage
      .map((usage) => {
        if (usage.voucherId === null) {
          return null;
        }

        const voucher = voucherMap.get(usage.voucherId);

        if (!voucher) {
          return null;
        }

        return {
          id: voucher.id,
          code: voucher.code,
          description: voucher.description,

          // Lượt dùng trong khoảng thời gian đang chọn
          periodUsedCount: usage._count.id,

          // Tổng lượt dùng toàn hệ thống
          usedCount: voucher.usedCount,

          usageLimit: voucher.usageLimit,

          // Số lượt còn lại thực tế của voucher
          remainingUsage:
            voucher.usageLimit !== null
              ? Math.max(voucher.usageLimit - voucher.usedCount, 0)
              : null,

          endAt: voucher.endAt,
          isActive: voucher.isActive,
        };
      })
      .filter(
        (voucher): voucher is NonNullable<typeof voucher> => voucher !== null,
      );

    return {
      period,

      totalDiscount: Number(totalDiscount._sum.discountAmount ?? 0),

      activeVouchers,

      topVouchers,
    };
  }
}
