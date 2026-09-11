import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardPeriod } from '../dashboard.types';
import { getDashboardPeriodRange } from '../utils/dashboard-period.util';

@Injectable()
export class DashboardOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // THỐNG KÊ TRẠNG THÁI ĐƠN
  // =========================

  // Thống kê số lượng đơn theo từng trạng thái trong khoảng thời gian
  async getOrderStatusStatistics(
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);

    // Dashboard Admin chỉ so sánh hai kết quả cuối cùng của đơn hàng.
    // Các trạng thái đang xử lý được theo dõi tại khu vận hành chi nhánh.
    const statuses = ['COMPLETED', 'CANCELLED'] as const;

    const counts = await Promise.all(
      statuses.map((status) =>
        this.prisma.order.count({
          where: {
            ...(branchId ? { branchId } : {}),
            status,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      ),
    );

    return statuses.map((status, index) => ({
      status,
      count: counts[index],
    }));
  }

  // =========================
  // ĐƠN HÀNG GẦN NHẤT
  // =========================

  // Lấy danh sách đơn hàng mới nhất trong khoảng thời gian
  async getRecentOrders(
    limit = 5,
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);

    const orders = await this.prisma.order.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },

      take: safeLimit,

      orderBy: {
        createdAt: 'desc',
      },

      select: {
        id: true,
        receiverName: true,
        receiverPhone: true,
        totalPrice: true,
        status: true,
        createdAt: true,

        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true } },
          },
        },

        payment: {
          select: {
            method: true,
            status: true,
          },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      receiverName: order.receiverName,
      receiverPhone: order.receiverPhone,
      totalPrice: Number(order.totalPrice),
      status: order.status,
      createdAt: order.createdAt,
      customer: {
        id: order.user.id,
        email: order.user.email,
        fullName: order.user.profile?.fullName ?? null,
      },
      payment: order.payment,
    }));
  }
}
