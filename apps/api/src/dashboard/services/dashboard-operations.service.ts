import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getPayrollMonthRange } from '../../payroll/payroll.util';
import type { DashboardPeriod } from '../dashboard.types';
import { getDashboardPeriodRange } from '../utils/dashboard-period.util';

const ACTIVE_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'DELIVERING',
] as const;

function vietnamDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function previousMonthKey(value = new Date()) {
  const [year, month] = vietnamDateKey(value).split('-').map(Number);
  const previousMonth = new Date(Date.UTC(year, month - 2, 1));
  return `${previousMonth.getUTCFullYear()}-${String(
    previousMonth.getUTCMonth() + 1,
  ).padStart(2, '0')}`;
}

@Injectable()
export class DashboardOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperations(branchId?: number) {
    const now = new Date();
    const today = vietnamDateKey(now);
    const todayStart = new Date(`${today}T00:00:00+07:00`);
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
    const inSevenDays = new Date(todayStart.getTime() + 7 * 86_400_000);
    const todayBusinessDate = new Date(`${today}T00:00:00.000Z`);
    const payrollMonth = previousMonthKey(now);
    const payrollRange = getPayrollMonthRange(payrollMonth);

    const [
      branches,
      stocks,
      pendingLeaveRequests,
      pendingLeaveCount,
      attendancePeriods,
      payrollPeriods,
      shiftsByBranch,
      activeOrdersByStatus,
      draftStockReceipts,
      pendingExpenses,
      cashSessionActions,
      expiredLotCount,
      expiringLotCount,
      inventoryLotAlerts,
      pendingInventoryCounts,
      pendingPurchaseOrders,
      overduePurchaseOrders,
      bankReconciliationIssues,
    ] = await Promise.all([
      this.prisma.storeBranch.findMany({
        where: { isActive: true, ...(branchId ? { id: branchId } : {}) },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.inventoryStock.findMany({
        where: {
          branch: { isActive: true, ...(branchId ? { id: branchId } : {}) },
          ingredient: { isActive: true },
        },
        select: {
          id: true,
          quantity: true,
          reservedQuantity: true,
          minimumLevel: true,
          ingredient: { select: { name: true, unit: true } },
          branch: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.staffLeaveRequest.findMany({
        where: { status: 'PENDING', ...(branchId ? { branchId } : {}) },
        take: 5,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          scope: true,
          reason: true,
          createdAt: true,
          requestedStartAt: true,
          requestedEndAt: true,
          employee: {
            select: {
              email: true,
              profile: { select: { fullName: true } },
            },
          },
          branch: { select: { id: true, code: true, name: true } },
          staffShift: { select: { startAt: true, endAt: true } },
        },
      }),
      this.prisma.staffLeaveRequest.count({
        where: { status: 'PENDING', ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.staffAttendancePeriod.findMany({
        where: {
          periodStart: payrollRange.periodStart,
          ...(branchId ? { branchId } : {}),
        },
        select: {
          id: true,
          branchId: true,
          status: true,
          submittedAt: true,
          reviewNote: true,
        },
      }),
      this.prisma.staffPayrollPeriod.findMany({
        where: {
          periodStart: payrollRange.periodStart,
          ...(branchId ? { branchId } : {}),
        },
        select: { id: true, branchId: true, status: true },
      }),
      this.prisma.staffShift.groupBy({
        by: ['branchId'],
        where: {
          branch: { isActive: true },
          ...(branchId ? { branchId } : {}),
          startAt: { lt: tomorrowStart },
          endAt: { gt: todayStart },
        },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: {
          status: { in: [...ACTIVE_ORDER_STATUSES] },
          ...(branchId ? { branchId } : {}),
        },
        _count: { _all: true },
      }),
      this.prisma.stockReceipt.count({
        where: { status: 'DRAFT', ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.branchExpense.count({
        where: { status: 'PENDING', ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.cashSession.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          OR: [
            { status: 'PENDING_REVIEW' },
            { status: 'OPEN', businessDate: { lt: todayBusinessDate } },
          ],
        },
        select: {
          id: true,
          code: true,
          businessDate: true,
          status: true,
          difference: true,
          branch: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ businessDate: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.inventoryLot.count({
        where: {
          ...(branchId ? { branchId } : {}),
          status: 'ACTIVE',
          quantity: { gt: 0 },
          expiresAt: { lt: todayStart },
        },
      }),
      this.prisma.inventoryLot.count({
        where: {
          ...(branchId ? { branchId } : {}),
          status: 'ACTIVE',
          quantity: { gt: 0 },
          expiresAt: { gte: todayStart, lte: inSevenDays },
        },
      }),
      this.prisma.inventoryLot.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          status: 'ACTIVE',
          quantity: { gt: 0 },
          expiresAt: { lte: inSevenDays },
        },
        select: {
          id: true,
          code: true,
          expiresAt: true,
          quantity: true,
          reservedQuantity: true,
          ingredient: { select: { name: true, unit: true } },
          branch: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
        take: 6,
      }),
      this.prisma.inventoryCount.count({
        where: {
          ...(branchId ? { branchId } : {}),
          status: 'PENDING',
        },
      }),
      this.prisma.purchaseOrder.count({
        where: {
          ...(branchId ? { branchId } : {}),
          status: 'PENDING',
        },
      }),
      this.prisma.purchaseOrder.count({
        where: {
          ...(branchId ? { branchId } : {}),
          status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] },
          expectedAt: { lt: todayStart },
        },
      }),
      this.prisma.bankTransaction.count({
        where: {
          ...(branchId ? { bankAccount: { branchId } } : {}),
          status: { in: ['UNMATCHED', 'AMOUNT_MISMATCH', 'DUPLICATE'] },
        },
      }),
    ]);

    const lowStockItems = stocks
      .map((stock) => {
        const quantity = Number(stock.quantity);
        const reservedQuantity = Number(stock.reservedQuantity);
        const availableQuantity = Math.max(0, quantity - reservedQuantity);
        const minimumLevel = Number(stock.minimumLevel);
        return {
          stockId: stock.id,
          ingredientName: stock.ingredient.name,
          unit: stock.ingredient.unit,
          quantity,
          reservedQuantity,
          availableQuantity,
          minimumLevel,
          branch: stock.branch,
        };
      })
      .filter((stock) => stock.availableQuantity <= stock.minimumLevel)
      .sort(
        (first, second) =>
          first.availableQuantity - second.availableQuantity ||
          first.ingredientName.localeCompare(second.ingredientName, 'vi'),
      );

    const attendanceByBranch = new Map(
      attendancePeriods.map((period) => [period.branchId, period]),
    );
    const payrollByBranch = new Map(
      payrollPeriods.map((period) => [period.branchId, period]),
    );
    const shiftsByBranchId = new Map(
      shiftsByBranch.map((item) => [item.branchId, item._count._all]),
    );

    const attendanceActions = branches.flatMap((branch) => {
      const period = attendanceByBranch.get(branch.id);
      if (period?.status === 'APPROVED') return [];
      return [
        {
          branch,
          status: period?.status ?? ('NOT_SUBMITTED' as const),
          submittedAt: period?.submittedAt ?? null,
          reviewNote: period?.reviewNote ?? null,
        },
      ];
    });

    const payrollActions = branches.flatMap((branch) => {
      const attendancePeriod = attendanceByBranch.get(branch.id);
      const payrollPeriod = payrollByBranch.get(branch.id);
      if (attendancePeriod?.status !== 'APPROVED') return [];
      if (payrollPeriod?.status === 'PAID') return [];
      return [
        {
          branch,
          status: payrollPeriod?.status ?? ('NOT_CREATED' as const),
        },
      ];
    });

    const branchesWithoutShifts = branches.filter(
      (branch) => !shiftsByBranchId.has(branch.id),
    );
    const todayShifts = shiftsByBranch.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const activeOrders = activeOrdersByStatus.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const pendingCashSessions = cashSessionActions.filter(
      (session) => session.status === 'PENDING_REVIEW',
    ).length;
    const overdueCashSessions = cashSessionActions.filter(
      (session) => session.status === 'OPEN',
    ).length;

    return {
      generatedAt: now,
      today,
      payrollMonth,
      summary: {
        lowStockItems: lowStockItems.length,
        pendingLeaveRequests: pendingLeaveCount,
        attendanceActions: attendanceActions.length,
        payrollActions: payrollActions.length,
        activeOrders,
        todayShifts,
        branchesWithoutShifts: branchesWithoutShifts.length,
        draftStockReceipts,
        pendingExpenses,
        pendingCashSessions,
        overdueCashSessions,
        expiredLots: expiredLotCount,
        expiringLots: expiringLotCount,
        pendingInventoryCounts,
        pendingPurchaseOrders,
        overduePurchaseOrders,
        bankReconciliationIssues,
      },
      lowStockItems: lowStockItems.slice(0, 6),
      pendingLeaveRequests: pendingLeaveRequests.map((request) => ({
        id: request.id,
        type: request.type,
        scope: request.scope,
        reason: request.reason,
        createdAt: request.createdAt,
        requestedStartAt: request.requestedStartAt,
        requestedEndAt: request.requestedEndAt,
        employeeName:
          request.employee.profile?.fullName ?? request.employee.email,
        branch: request.branch,
        shift: request.staffShift,
      })),
      attendanceActions,
      payrollActions,
      branchesWithoutShifts,
      activeOrdersByStatus: activeOrdersByStatus.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      cashSessionActions: cashSessionActions.map((session) => ({
        ...session,
        difference:
          session.difference === null ? null : Number(session.difference),
      })),
      inventoryLotAlerts: inventoryLotAlerts.map((lot) => {
        const quantity = Number(lot.quantity);
        const reservedQuantity = Number(lot.reservedQuantity);
        const daysToExpiry = lot.expiresAt
          ? Math.ceil(
              (lot.expiresAt.getTime() - todayStart.getTime()) / 86_400_000,
            )
          : null;

        return {
          id: lot.id,
          code: lot.code,
          ingredientName: lot.ingredient.name,
          unit: lot.ingredient.unit,
          quantity,
          reservedQuantity,
          availableQuantity: Math.max(0, quantity - reservedQuantity),
          expiresAt: lot.expiresAt,
          daysToExpiry,
          expiryState:
            daysToExpiry !== null && daysToExpiry < 0
              ? ('EXPIRED' as const)
              : ('EXPIRING' as const),
          branch: lot.branch,
        };
      }),
    };
  }

  async getBranchHealth(
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);
    const today = vietnamDateKey();
    const todayStart = new Date(`${today}T00:00:00+07:00`);
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
    const branchWhere = branchId ? { id: branchId } : {};

    const branches = await this.prisma.storeBranch.findMany({
      where: branchWhere,
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        isAcceptingOrders: true,
        pauseReason: true,
        manager: {
          select: {
            email: true,
            profile: { select: { fullName: true } },
          },
        },
        staff: {
          where: { user: { isActive: true } },
          select: { userId: true },
        },
      },
      orderBy: { code: 'asc' },
    });
    const branchIds = branches.map((branch) => branch.id);

    if (!branchIds.length) return [];

    const [
      periodOrderStats,
      activeOrderStats,
      shiftsToday,
      staffOnDuty,
      stocks,
    ] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['branchId', 'status'],
        where: {
          branchId: { in: branchIds },
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: { _all: true },
        _sum: { totalPrice: true },
      }),
      this.prisma.order.groupBy({
        by: ['branchId'],
        where: {
          branchId: { in: branchIds },
          status: { in: [...ACTIVE_ORDER_STATUSES] },
        },
        _count: { _all: true },
      }),
      this.prisma.staffShift.groupBy({
        by: ['branchId'],
        where: {
          branchId: { in: branchIds },
          startAt: { lt: tomorrowStart },
          endAt: { gt: todayStart },
        },
        _count: { _all: true },
      }),
      this.prisma.staffAttendance.groupBy({
        by: ['branchId'],
        where: { branchId: { in: branchIds }, clockOut: null },
        _count: { _all: true },
      }),
      this.prisma.inventoryStock.findMany({
        where: {
          branchId: { in: branchIds },
          ingredient: { isActive: true },
        },
        select: {
          branchId: true,
          quantity: true,
          reservedQuantity: true,
          minimumLevel: true,
        },
      }),
    ]);

    const activeOrdersByBranch = new Map(
      activeOrderStats.map((item) => [item.branchId, item._count._all]),
    );
    const shiftsByBranch = new Map(
      shiftsToday.map((item) => [item.branchId, item._count._all]),
    );
    const staffOnDutyByBranch = new Map(
      staffOnDuty.map((item) => [item.branchId, item._count._all]),
    );
    const lowStockByBranch = new Map<number, number>();
    for (const stock of stocks) {
      const available = Number(stock.quantity) - Number(stock.reservedQuantity);
      if (available <= Number(stock.minimumLevel)) {
        lowStockByBranch.set(
          stock.branchId,
          (lowStockByBranch.get(stock.branchId) ?? 0) + 1,
        );
      }
    }

    return branches.map((branch) => {
      const orderStats = periodOrderStats.filter(
        (item) => item.branchId === branch.id,
      );
      const periodOrders = orderStats.reduce(
        (total, item) => total + item._count._all,
        0,
      );
      const completed = orderStats.find((item) => item.status === 'COMPLETED');
      const cancelled = orderStats.find((item) => item.status === 'CANCELLED');
      const completedOrders = completed?._count._all ?? 0;
      const cancelledOrders = cancelled?._count._all ?? 0;
      const revenue = Number(completed?._sum.totalPrice ?? 0);
      const cancellationRate =
        periodOrders > 0 ? (cancelledOrders / periodOrders) * 100 : 0;
      const lowStockItems = lowStockByBranch.get(branch.id) ?? 0;
      const todayShifts = shiftsByBranch.get(branch.id) ?? 0;
      const managerName =
        branch.manager?.profile?.fullName ?? branch.manager?.email ?? null;

      const health =
        !branch.isActive || !branch.isAcceptingOrders
          ? 'PAUSED'
          : !managerName ||
              lowStockItems > 0 ||
              todayShifts === 0 ||
              cancellationRate >= 20
            ? 'ATTENTION'
            : 'HEALTHY';

      return {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        isActive: branch.isActive,
        isAcceptingOrders: branch.isAcceptingOrders,
        pauseReason: branch.pauseReason,
        managerName,
        activeStaff: branch.staff.length,
        staffOnDuty: staffOnDutyByBranch.get(branch.id) ?? 0,
        todayShifts,
        lowStockItems,
        activeOrders: activeOrdersByBranch.get(branch.id) ?? 0,
        periodOrders,
        completedOrders,
        cancelledOrders,
        revenue,
        averageOrderValue: completedOrders > 0 ? revenue / completedOrders : 0,
        cancellationRate: Number(cancellationRate.toFixed(1)),
        health,
      };
    });
  }
}
