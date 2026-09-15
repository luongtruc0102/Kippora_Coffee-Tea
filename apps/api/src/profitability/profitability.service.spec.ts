import { ProfitabilityService } from './profitability.service';

describe('ProfitabilityService', () => {
  it('tổng hợp đúng doanh thu, giá vốn, hoàn tiền và chi phí thực tế', async () => {
    const prisma = {
      storeBranch: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 1, code: 'MAIN', name: 'Kippora - Q9', isActive: true },
          ]),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            amount: 100_000,
            paidAt: new Date('2026-09-10T03:00:00.000Z'),
            status: 'REFUNDED',
            order: {
              id: 12,
              branchId: 1,
              channel: 'POS',
              status: 'CANCELLED',
              inventoryState: 'CONSUMED',
              branch: { code: 'MAIN', name: 'Kippora - Q9' },
              refund: {
                amount: 10_000,
                processedAt: new Date('2026-09-11T04:00:00.000Z'),
              },
              ingredientLotAllocations: [
                { quantity: 2, unitCost: 15_000, costAmount: 30_000 },
              ],
              inventoryReservations: [{ ingredientId: 1, quantity: 2 }],
            },
          },
        ]),
      },
      paymentRefund: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 2,
            branchId: 1,
            amount: 10_000,
            processedAt: new Date('2026-09-11T04:00:00.000Z'),
            orderId: 12,
          },
        ]),
      },
      branchExpense: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3,
            branchId: 1,
            amount: 5_000,
            incurredOn: new Date('2026-09-12T00:00:00.000Z'),
          },
        ]),
      },
      staffPayrollPeriod: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 4,
            branchId: 1,
            status: 'FINALIZED',
            periodStart: new Date('2026-09-01T00:00:00.000Z'),
            periodEnd: new Date('2026-10-01T00:00:00.000Z'),
            entries: [{ totalAmount: 20_000 }],
          },
          {
            id: 5,
            branchId: 1,
            status: 'DRAFT',
            periodStart: new Date('2026-09-01T00:00:00.000Z'),
            periodEnd: new Date('2026-10-01T00:00:00.000Z'),
            entries: [{ totalAmount: 999_999 }],
          },
        ]),
      },
      inventoryLotDisposal: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 6,
            branchId: 1,
            quantity: 2,
            createdAt: new Date('2026-09-13T05:00:00.000Z'),
            reason: 'DAMAGED',
            lot: { unitCost: 1_000 },
          },
        ]),
      },
      inventoryLot: {
        findMany: jest.fn().mockResolvedValue([
          {
            branchId: 1,
            ingredientId: 1,
            unitCost: 15_000,
            receivedAt: new Date('2026-09-01T00:00:00.000Z'),
          },
        ]),
      },
    };
    const service = new ProfitabilityService(prisma as never);

    const result = await service.getReport({
      from: '2026-09-01',
      to: '2026-09-30',
    });

    expect(result.summary).toEqual(
      expect.objectContaining({
        grossRevenue: 100_000,
        refunds: 10_000,
        netRevenue: 90_000,
        cogs: 30_000,
        grossProfit: 60_000,
        approvedExpenses: 5_000,
        payroll: 20_000,
        inventoryLoss: 2_000,
        netProfit: 33_000,
        grossMarginPercent: 66.67,
        netMarginPercent: 36.67,
      }),
    );
    expect(result.dataQuality.pendingPayrollPeriods).toBe(1);
    expect(result.branches[0].netProfit).toBe(33_000);
    expect(result.orders[0]).toEqual(
      expect.objectContaining({ orderId: 12, cogs: 30_000 }),
    );
  });
});
