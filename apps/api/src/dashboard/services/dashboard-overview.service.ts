import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardPeriod } from '../dashboard.types';
import { getDashboardPeriodRange } from '../utils/dashboard-period.util';

@Injectable()
export class DashboardOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy các KPI chính hiển thị ở đầu dashboard
  async getOverview(
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const {
      startDate,
      endDate,
      previousStartDate,
      previousEndDate,
    } = getDashboardPeriodRange(period, from, to);
    const orderBranchFilter = branchId ? { branchId } : {};

    const [
      periodRevenue,
      periodOrders,
      newCustomers,
      activeProducts,
      activeBranches,
      totalBranches,
      totalRevenue,
      completedOrders,
      cancelledOrders,
      previousRevenue,
      previousOrders,
      previousNewCustomers,
      previousCompletedOrders,
      previousCancelledOrders,
      approvedExpenses,
      inventoryPurchases,
      attendances,
    ] = await Promise.all([
      // Doanh thu trong khoảng đang chọn
      this.prisma.order.aggregate({
        where: {
          ...orderBranchFilter,
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          totalPrice: true,
        },
      }),

      // Tổng số đơn trong khoảng đang chọn
      this.prisma.order.count({
        where: {
          ...orderBranchFilter,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // Khách hàng mới trong khoảng đang chọn
      this.prisma.user.count({
        where: {
          role: {
            name: 'USER',
          },
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          ...(branchId
            ? { orders: { some: { branchId } } }
            : {}),
        },
      }),

      // Dữ liệu hiện tại, không phụ thuộc khoảng thời gian
      this.prisma.product.count({
        where: {
          isActive: true,
          category: {
            isActive: true,
          },
        },
      }),

      // Số chi nhánh đang hoạt động ở thời điểm hiện tại.
      this.prisma.storeBranch.count({
        where: {
          ...(branchId ? { id: branchId } : {}),
          isActive: true,
        },
      }),

      // Tổng chi nhánh để Admin nhận biết ngay có điểm bán đang bị khóa.
      this.prisma.storeBranch.count({
        where: branchId ? { id: branchId } : undefined,
      }),

      // Tổng doanh thu toàn hệ thống
      this.prisma.order.aggregate({
        where: {
          ...orderBranchFilter,
          status: 'COMPLETED',
        },
        _sum: {
          totalPrice: true,
        },
      }),

      this.prisma.order.count({
        where: {
          ...orderBranchFilter,
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      this.prisma.order.count({
        where: {
          ...orderBranchFilter,
          status: 'CANCELLED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // Các số liệu của kỳ liền trước có cùng độ dài để so sánh công bằng.
      this.prisma.order.aggregate({
        where: {
          ...orderBranchFilter,
          status: 'COMPLETED',
          createdAt: {
            gte: previousStartDate,
            lte: previousEndDate,
          },
        },
        _sum: { totalPrice: true },
      }),

      this.prisma.order.count({
        where: {
          ...orderBranchFilter,
          createdAt: {
            gte: previousStartDate,
            lte: previousEndDate,
          },
        },
      }),

      this.prisma.user.count({
        where: {
          role: { name: 'USER' },
          createdAt: {
            gte: previousStartDate,
            lte: previousEndDate,
          },
          ...(branchId ? { orders: { some: { branchId } } } : {}),
        },
      }),

      this.prisma.order.count({
        where: {
          ...orderBranchFilter,
          status: 'COMPLETED',
          createdAt: {
            gte: previousStartDate,
            lte: previousEndDate,
          },
        },
      }),

      this.prisma.order.count({
        where: {
          ...orderBranchFilter,
          status: 'CANCELLED',
          createdAt: {
            gte: previousStartDate,
            lte: previousEndDate,
          },
        },
      }),

      // Chỉ khoản chi đã được Admin duyệt mới đi vào báo cáo.
      this.prisma.branchExpense.aggregate({
        where: {
          ...(branchId ? { branchId } : {}),
          status: 'APPROVED',
          incurredOn: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),

      // Phiếu đã hoàn tất là dòng tiền mua nguyên liệu thực tế trong kỳ.
      this.prisma.stockReceipt.aggregate({
        where: {
          ...(branchId ? { branchId } : {}),
          status: 'COMPLETED',
          receivedAt: { gte: startDate, lte: endDate },
        },
        _sum: { totalCost: true },
      }),

      // Ước tính chi phí nhân công từ giờ chấm công thực tế trong kỳ.
      this.prisma.staffAttendance.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          clockIn: { lte: endDate },
          clockOut: { not: null, gte: startDate },
        },
        select: {
          clockIn: true,
          clockOut: true,
          scheduledShift: { select: { endAt: true } },
          employee: {
            select: {
              staffProfile: {
                select: { hourlyRate: true, overtimeMultiplier: true },
              },
            },
          },
        },
      }),
    ]);

    const revenue = Number(periodRevenue._sum.totalPrice ?? 0);

    // Giá trị trung bình của mỗi đơn đã hoàn thành
    const averageOrderValue =
      completedOrders > 0 ? revenue / completedOrders : 0;

    // Tỷ lệ đơn bị hủy trong khoảng thời gian
    const cancellationRate =
      periodOrders > 0 ? (cancelledOrders / periodOrders) * 100 : 0;

    const previousRevenueValue = Number(previousRevenue._sum.totalPrice ?? 0);
    const previousAverageOrderValue =
      previousCompletedOrders > 0
        ? previousRevenueValue / previousCompletedOrders
        : 0;
    const previousCancellationRate =
      previousOrders > 0
        ? (previousCancelledOrders / previousOrders) * 100
        : 0;

    const percentageChange = (current: number, previous: number) => {
      if (previous === 0) return current === 0 ? 0 : null;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const operatingExpense = Number(approvedExpenses._sum.amount ?? 0);
    const inventoryPurchaseCost = Number(
      inventoryPurchases._sum.totalCost ?? 0,
    );
    const estimatedLaborCost = attendances.reduce((total, attendance) => {
      if (!attendance.clockOut || !attendance.employee.staffProfile) {
        return total;
      }
      const workedStart = Math.max(
        attendance.clockIn.getTime(),
        startDate.getTime(),
      );
      const workedEnd = Math.min(
        attendance.clockOut.getTime(),
        endDate.getTime(),
      );
      if (workedEnd <= workedStart) return total;

      const shiftEnd = attendance.scheduledShift?.endAt.getTime();
      const regularEnd = shiftEnd
        ? Math.min(workedEnd, shiftEnd)
        : workedEnd;
      const regularSeconds = Math.max(0, regularEnd - workedStart) / 1000;
      const overtimeStart = shiftEnd
        ? Math.max(workedStart, shiftEnd)
        : workedEnd;
      const overtimeSeconds = Math.max(0, workedEnd - overtimeStart) / 1000;
      const hourlyRate = Number(attendance.employee.staffProfile.hourlyRate);
      const overtimeMultiplier = Number(
        attendance.employee.staffProfile.overtimeMultiplier,
      );

      return (
        total +
        (regularSeconds / 3600) * hourlyRate +
        (overtimeSeconds / 3600) * hourlyRate * overtimeMultiplier
      );
    }, 0);
    const roundedLaborCost = Math.round(estimatedLaborCost);
    const totalEstimatedCost =
      operatingExpense + inventoryPurchaseCost + roundedLaborCost;
    const estimatedProfit = revenue - totalEstimatedCost;

    return {
      period,
      periodRevenue: revenue,

      totalRevenue: Number(totalRevenue._sum.totalPrice ?? 0),

      periodOrders,
      newCustomers,
      activeProducts,
      activeBranches,
      totalBranches,

      averageOrderValue,
      cancellationRate,
      financials: {
        approvedOperatingExpenses: operatingExpense,
        inventoryPurchases: inventoryPurchaseCost,
        estimatedLaborCost: roundedLaborCost,
        totalEstimatedCost,
        estimatedProfit,
        estimatedProfitMargin:
          revenue > 0
            ? Number(((estimatedProfit / revenue) * 100).toFixed(1))
            : 0,
      },
      range: {
        startDate,
        endDate,
      },
      comparison: {
        previousStartDate,
        previousEndDate,
        revenueChangePercent: percentageChange(
          revenue,
          previousRevenueValue,
        ),
        orderChangePercent: percentageChange(periodOrders, previousOrders),
        newCustomerChangePercent: percentageChange(
          newCustomers,
          previousNewCustomers,
        ),
        averageOrderValueChangePercent: percentageChange(
          averageOrderValue,
          previousAverageOrderValue,
        ),
        cancellationRateChangePoints: Number(
          (cancellationRate - previousCancellationRate).toFixed(1),
        ),
      },
    };
  }
}
