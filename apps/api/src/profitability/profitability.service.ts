import { Injectable, NotFoundException } from '@nestjs/common';
import { getDashboardPeriodRange } from '../dashboard/utils/dashboard-period.util';
import { PrismaService } from '../prisma/prisma.service';
import { ProfitabilityReportQueryDto } from './dto/profitability-report-query.dto';

const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

type FinancialTotals = {
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  approvedExpenses: number;
  payroll: number;
  inventoryLoss: number;
  netProfit: number;
};

type BranchAccumulator = FinancialTotals & {
  branchId: number;
  branchCode: string;
  branchName: string;
  paidOrders: number;
  refundCount: number;
};

function emptyFinancials(): FinancialTotals {
  return {
    grossRevenue: 0,
    refunds: 0,
    netRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    approvedExpenses: 0,
    payroll: 0,
    inventoryLoss: 0,
    netProfit: 0,
  };
}

function number(value: { toString(): string } | number | null | undefined) {
  return value === null || value === undefined ? 0 : Number(value.toString());
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function margin(profit: number, revenue: number) {
  return revenue === 0 ? 0 : round((profit / revenue) * 100);
}

function dateValue(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function nextDate(value: string) {
  return new Date(dateValue(value).getTime() + 86_400_000);
}

function finalizeFinancials<T extends FinancialTotals>(value: T) {
  value.netRevenue = round(value.grossRevenue - value.refunds);
  value.grossProfit = round(value.netRevenue - value.cogs);
  value.netProfit = round(
    value.grossProfit -
      value.approvedExpenses -
      value.payroll -
      value.inventoryLoss,
  );
  return {
    ...value,
    grossMarginPercent: margin(value.grossProfit, value.netRevenue),
    netMarginPercent: margin(value.netProfit, value.netRevenue),
  };
}

@Injectable()
export class ProfitabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(query: ProfitabilityReportQueryDto) {
    const today = vietnamDateFormatter.format(new Date());
    const from = query.from ?? `${today.slice(0, 7)}-01`;
    const to = query.to ?? today;
    const { startDate, endDate } = getDashboardPeriodRange('CUSTOM', from, to);
    const calendarStart = dateValue(from);
    const calendarEndExclusive = nextDate(to);

    const branches = await this.prisma.storeBranch.findMany({
      where: query.branchId ? { id: query.branchId } : undefined,
      select: { id: true, code: true, name: true, isActive: true },
      orderBy: { code: 'asc' },
    });
    if (query.branchId && branches.length === 0) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }

    const directBranchWhere = query.branchId
      ? { branchId: query.branchId }
      : {};
    const paymentBranchWhere = query.branchId
      ? { order: { branchId: query.branchId } }
      : {};
    const [payments, refunds, expenses, payrollPeriods, disposals, pricedLots] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: {
            ...paymentBranchWhere,
            status: { in: ['PAID', 'REFUNDED'] },
            paidAt: { gte: startDate, lte: endDate },
          },
          select: {
            id: true,
            amount: true,
            paidAt: true,
            status: true,
            order: {
              select: {
                id: true,
                branchId: true,
                channel: true,
                status: true,
                inventoryState: true,
                branch: { select: { code: true, name: true } },
                refund: { select: { amount: true, processedAt: true } },
                ingredientLotAllocations: {
                  where: { state: 'CONSUMED' },
                  select: {
                    quantity: true,
                    unitCost: true,
                    costAmount: true,
                  },
                },
                inventoryReservations: {
                  where: { state: 'CONSUMED' },
                  select: { ingredientId: true, quantity: true },
                },
              },
            },
          },
          orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.paymentRefund.findMany({
          where: {
            ...directBranchWhere,
            processedAt: { gte: startDate, lte: endDate },
          },
          select: {
            id: true,
            branchId: true,
            amount: true,
            processedAt: true,
            orderId: true,
          },
        }),
        this.prisma.branchExpense.findMany({
          where: {
            ...directBranchWhere,
            status: 'APPROVED',
            incurredOn: { gte: calendarStart, lt: calendarEndExclusive },
          },
          select: {
            id: true,
            branchId: true,
            amount: true,
            incurredOn: true,
          },
        }),
        this.prisma.staffPayrollPeriod.findMany({
          where: {
            ...directBranchWhere,
            periodEnd: { gt: calendarStart, lte: calendarEndExclusive },
            status: { in: ['DRAFT', 'FINALIZED', 'PAID'] },
          },
          select: {
            id: true,
            branchId: true,
            status: true,
            periodStart: true,
            periodEnd: true,
            entries: { select: { totalAmount: true } },
          },
        }),
        this.prisma.inventoryLotDisposal.findMany({
          where: {
            ...directBranchWhere,
            createdAt: { gte: startDate, lte: endDate },
          },
          select: {
            id: true,
            branchId: true,
            quantity: true,
            createdAt: true,
            reason: true,
            lot: { select: { unitCost: true } },
          },
        }),
        this.prisma.inventoryLot.findMany({
          where: {
            ...directBranchWhere,
            unitCost: { gt: 0 },
          },
          select: {
            branchId: true,
            ingredientId: true,
            unitCost: true,
            receivedAt: true,
          },
          orderBy: { receivedAt: 'desc' },
        }),
      ]);

    // Đơn cũ không có allocation theo lô. Dùng giá lô gần nhất làm ước tính
    // chuyển tiếp và đánh dấu rõ; đơn mới vẫn luôn lấy snapshot giá lô thực tế.
    const latestUnitCost = new Map<string, number>();
    for (const lot of pricedLots) {
      const key = `${lot.branchId}:${lot.ingredientId}`;
      if (!latestUnitCost.has(key))
        latestUnitCost.set(key, number(lot.unitCost));
    }

    const summary = { ...emptyFinancials(), paidOrders: payments.length };
    const branchMap = new Map<number, BranchAccumulator>(
      branches.map((branch) => [
        branch.id,
        {
          ...emptyFinancials(),
          branchId: branch.id,
          branchCode: branch.code,
          branchName: branch.name,
          paidOrders: 0,
          refundCount: 0,
        },
      ]),
    );
    const timeline = new Map<string, FinancialTotals>();
    for (
      let cursor = calendarStart;
      cursor < calendarEndExclusive;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      timeline.set(cursor.toISOString().slice(0, 10), emptyFinancials());
    }

    let zeroCostAllocations = 0;
    let paidOrdersWithoutConsumedInventory = 0;
    let estimatedCostOrders = 0;

    const orderRows = payments.map((payment) => {
      const order = payment.order;
      const grossRevenue = number(payment.amount);
      const hasLotAllocations = order.ingredientLotAllocations.length > 0;
      const cogs = hasLotAllocations
        ? order.ingredientLotAllocations.reduce(
            (total, allocation) => total + number(allocation.costAmount),
            0,
          )
        : order.inventoryReservations.reduce(
            (total, reservation) =>
              total +
              number(reservation.quantity) *
                (latestUnitCost.get(
                  `${order.branchId}:${reservation.ingredientId}`,
                ) ?? 0),
            0,
          );
      const unpricedAllocations = hasLotAllocations
        ? order.ingredientLotAllocations.filter(
            (allocation) =>
              number(allocation.quantity) > 0 &&
              number(allocation.unitCost) <= 0,
          ).length
        : order.inventoryReservations.filter(
            (reservation) =>
              number(reservation.quantity) > 0 &&
              !latestUnitCost.get(
                `${order.branchId}:${reservation.ingredientId}`,
              ),
          ).length;
      zeroCostAllocations += unpricedAllocations;
      const hasEstimatedCost =
        !hasLotAllocations && order.inventoryReservations.length > 0;
      if (hasEstimatedCost) estimatedCostOrders += 1;
      if (
        order.inventoryState !== 'CONSUMED' ||
        (!hasLotAllocations && order.inventoryReservations.length === 0)
      ) {
        paidOrdersWithoutConsumedInventory += 1;
      }

      summary.grossRevenue += grossRevenue;
      summary.cogs += cogs;
      const branch = branchMap.get(order.branchId);
      if (branch) {
        branch.grossRevenue += grossRevenue;
        branch.cogs += cogs;
        branch.paidOrders += 1;
      }
      const paidAt = payment.paidAt!;
      const day = timeline.get(vietnamDateFormatter.format(paidAt));
      if (day) {
        day.grossRevenue += grossRevenue;
        day.cogs += cogs;
      }

      const refundedAmount = number(order.refund?.amount);
      const netRevenueAfterRefund = grossRevenue - refundedAmount;
      const grossProfitAfterRefund = netRevenueAfterRefund - cogs;
      return {
        orderId: order.id,
        branchId: order.branchId,
        branchCode: order.branch.code,
        branchName: order.branch.name,
        channel: order.channel,
        orderStatus: order.status,
        paymentStatus: payment.status,
        inventoryState: order.inventoryState,
        paidAt,
        grossRevenue: round(grossRevenue),
        refundedAmount: round(refundedAmount),
        cogs: round(cogs),
        grossProfit: round(grossProfitAfterRefund),
        grossMarginPercent: margin(
          grossProfitAfterRefund,
          netRevenueAfterRefund,
        ),
        unpricedAllocations,
        costSource: hasLotAllocations
          ? ('LOT' as const)
          : hasEstimatedCost
            ? ('ESTIMATED' as const)
            : ('MISSING' as const),
      };
    });

    for (const refund of refunds) {
      const amount = number(refund.amount);
      summary.refunds += amount;
      const branch = branchMap.get(refund.branchId);
      if (branch) {
        branch.refunds += amount;
        branch.refundCount += 1;
      }
      const day = timeline.get(vietnamDateFormatter.format(refund.processedAt));
      if (day) day.refunds += amount;
    }

    for (const expense of expenses) {
      const amount = number(expense.amount);
      summary.approvedExpenses += amount;
      const branch = branchMap.get(expense.branchId);
      if (branch) branch.approvedExpenses += amount;
      const day = timeline.get(expense.incurredOn.toISOString().slice(0, 10));
      if (day) day.approvedExpenses += amount;
    }

    let pendingPayrollPeriods = 0;
    for (const period of payrollPeriods) {
      if (period.status === 'DRAFT') {
        pendingPayrollPeriods += 1;
        continue;
      }
      const amount = period.entries.reduce(
        (total, entry) => total + number(entry.totalAmount),
        0,
      );
      summary.payroll += amount;
      const branch = branchMap.get(period.branchId);
      if (branch) branch.payroll += amount;
      const recognitionDate = new Date(period.periodEnd.getTime() - 86_400_000)
        .toISOString()
        .slice(0, 10);
      const day = timeline.get(recognitionDate);
      if (day) day.payroll += amount;
    }

    for (const disposal of disposals) {
      const amount = number(disposal.quantity) * number(disposal.lot.unitCost);
      summary.inventoryLoss += amount;
      const branch = branchMap.get(disposal.branchId);
      if (branch) branch.inventoryLoss += amount;
      const day = timeline.get(vietnamDateFormatter.format(disposal.createdAt));
      if (day) day.inventoryLoss += amount;
    }

    return {
      filters: { from, to, branchId: query.branchId ?? null },
      generatedAt: new Date(),
      accountingBasis: {
        revenue: 'Thời điểm thanh toán thành công',
        refunds: 'Thời điểm hoàn tiền',
        cogs: 'Giá lô đã chụp của từng nguyên liệu dùng cho đơn đã thanh toán',
        expenses: 'Ngày phát sinh khoản chi đã được Admin duyệt',
        payroll: 'Ngày cuối kỳ lương đã chốt hoặc đã thanh toán',
      },
      summary: {
        ...finalizeFinancials(summary),
        refundCount: refunds.length,
      },
      dataQuality: {
        zeroCostAllocations,
        paidOrdersWithoutConsumedInventory,
        pendingPayrollPeriods,
        estimatedCostOrders,
      },
      branches: Array.from(branchMap.values()).map((branch) =>
        finalizeFinancials(branch),
      ),
      timeline: Array.from(timeline.entries()).map(([date, financials]) => ({
        date,
        ...finalizeFinancials(financials),
      })),
      orders: orderRows,
    };
  }
}
