import { MonthCloseService } from './month-close.service';

const report = {
  filters: { from: '2026-08-01', to: '2026-08-31', branchId: 1 },
  generatedAt: new Date('2026-09-01T01:00:00.000Z'),
  accountingBasis: {},
  summary: {
    grossRevenue: 10_000_000,
    refunds: 100_000,
    netRevenue: 9_900_000,
    cogs: 3_000_000,
    grossProfit: 6_900_000,
    approvedExpenses: 1_000_000,
    payroll: 2_000_000,
    inventoryLoss: 50_000,
    netProfit: 3_850_000,
    grossMarginPercent: 69.7,
    netMarginPercent: 38.89,
    paidOrders: 120,
    refundCount: 1,
  },
  dataQuality: {
    zeroCostAllocations: 0,
    paidOrdersWithoutConsumedInventory: 0,
    pendingPayrollPeriods: 0,
    estimatedCostOrders: 2,
  },
  branches: [],
  timeline: [],
  products: [],
  orders: [],
};

function createMocks(options?: { openCashSessions?: number }) {
  const period = {
    id: 9,
    branchId: 1,
    periodStart: new Date('2026-08-01T00:00:00.000Z'),
    periodEnd: new Date('2026-09-01T00:00:00.000Z'),
    status: 'CLOSED',
    version: 1,
    snapshot: { schemaVersion: 1 },
    closedById: 1,
    closedAt: new Date(),
    closeNote: 'Đã kiểm tra',
    reopenedById: null,
    reopenedAt: null,
    reopenReason: null,
  };
  const tx = {
    monthlyClosePeriod: {
      create: jest.fn().mockResolvedValue(period),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(period),
    },
    monthlyCloseEvent: { create: jest.fn().mockResolvedValue({ id: 10 }) },
    notification: { create: jest.fn().mockResolvedValue({ id: 11 }) },
  };
  const prisma = {
    storeBranch: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        code: 'MAIN',
        name: 'Kippora - Q9',
        managerId: 5,
      }),
    },
    monthlyClosePeriod: { findUnique: jest.fn().mockResolvedValue(null) },
    cashSession: {
      count: jest
        .fn()
        .mockResolvedValueOnce(options?.openCashSessions ?? 0)
        .mockResolvedValueOnce(0),
    },
    branchExpense: { count: jest.fn().mockResolvedValue(0) },
    inventoryCount: { count: jest.fn().mockResolvedValue(0) },
    stockReceipt: { count: jest.fn().mockResolvedValue(0) },
    order: { count: jest.fn().mockResolvedValue(0) },
    staffPayrollPeriod: {
      findUnique: jest.fn().mockResolvedValue({ id: 6, status: 'FINALIZED' }),
    },
    staffProfile: { count: jest.fn().mockResolvedValue(2) },
    bankTransaction: { count: jest.fn().mockResolvedValue(0) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 12 }) },
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
  const profitability = { getReport: jest.fn().mockResolvedValue(report) };
  return { prisma, profitability, tx };
}

describe('MonthCloseService', () => {
  it('chỉ cho phép chốt khi tháng đã kết thúc và mọi chứng từ đã hoàn tất', async () => {
    const { prisma, profitability } = createMocks();
    const service = new MonthCloseService(
      prisma as never,
      profitability as never,
    );

    const result = await service.getOverview(1, 'ADMIN', {
      branchId: 1,
      month: '2026-08',
    });

    expect(result.canClose).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'ESTIMATED_COST', count: 2 }),
    ]);
  });

  it('lưu snapshot và sự kiện bất biến khi Admin chốt sổ', async () => {
    const { prisma, profitability, tx } = createMocks();
    const service = new MonthCloseService(
      prisma as never,
      profitability as never,
    );

    const result = await service.closeMonth(1, {
      branchId: 1,
      month: '2026-08',
      note: 'Đã đối soát đầy đủ',
    });

    expect(tx.monthlyClosePeriod.create).toHaveBeenCalled();
    expect(tx.monthlyCloseEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ status: 'CLOSED', version: 1 }),
    );
  });

  it('hiển thị chứng từ treo và không cho chốt', async () => {
    const { prisma, profitability } = createMocks({ openCashSessions: 2 });
    const service = new MonthCloseService(
      prisma as never,
      profitability as never,
    );

    const result = await service.getOverview(1, 'ADMIN', {
      branchId: 1,
      month: '2026-08',
    });

    expect(result.canClose).toBe(false);
    expect(result.blockers).toEqual([
      expect.objectContaining({ code: 'CASH_SESSION_PENDING', count: 2 }),
    ]);
  });
});
