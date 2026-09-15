import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CashSessionStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import { CashSessionsService } from './cash-sessions.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const branch = {
  id: 1,
  code: 'MAIN',
  name: 'Kippora - Q9',
  isActive: true,
};

const person = {
  id: 2,
  email: 'manager@example.com',
  profile: { fullName: 'Nhân viên trưởng', phone: null, avatarUrl: null },
};

function cashSession(status: CashSessionStatus) {
  return {
    id: 10,
    code: 'Q-20260908-MAIN',
    branchId: branch.id,
    branch,
    businessDate: new Date('2026-09-08T00:00:00.000Z'),
    status,
    openingFloat: 1_000_000,
    openingNote: null,
    openedById: person.id,
    openedBy: person,
    openedAt: new Date(),
    cashSalesAmount: 500_000,
    bankSalesAmount: 200_000,
    cashExpenseAmount: 100_000,
    cashRefundAmount: 0,
    bankRefundAmount: 0,
    expectedCash: 1_400_000,
    actualCash: 1_400_000,
    difference: 0,
    closingNote: null,
    closedById: person.id,
    closedBy: person,
    closedAt: new Date(),
    approvedById: null,
    approvedBy: null,
    approvedAt: null,
    reviewNote: null,
    reopenedById: null,
    reopenedBy: null,
    reopenedAt: null,
    reopenReason: null,
    events: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function financialPrisma(options?: {
  cashSales?: number;
  bankSales?: number;
  cashExpense?: number;
  pendingExpenses?: number;
  cashRefund?: number;
  bankRefund?: number;
}) {
  return {
    payment: {
      groupBy: jest.fn().mockResolvedValue([
        {
          method: 'COD',
          _sum: { amount: options?.cashSales ?? 500_000 },
        },
        {
          method: 'BANK_TRANSFER',
          _sum: { amount: options?.bankSales ?? 200_000 },
        },
      ]),
    },
    paymentRefund: {
      groupBy: jest.fn().mockResolvedValue([
        { method: 'CASH', _sum: { amount: options?.cashRefund ?? 0 } },
        {
          method: 'BANK_TRANSFER',
          _sum: { amount: options?.bankRefund ?? 0 },
        },
      ]),
    },
    branchExpense: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: options?.cashExpense ?? 100_000 },
      }),
      count: jest.fn().mockResolvedValue(options?.pendingExpenses ?? 0),
    },
  };
}

describe('CashSessionsService', () => {
  it('calculates expected cash from opening float, paid cash sales and approved cash expenses', async () => {
    const prisma = financialPrisma({
      cashSales: 650_000,
      bankSales: 300_000,
      cashExpense: 125_000,
      pendingExpenses: 2,
      cashRefund: 50_000,
      bankRefund: 30_000,
    });
    const service = new CashSessionsService(prisma as unknown as PrismaService);

    const result = await (
      service as unknown as {
        calculate: (
          client: unknown,
          branchId: number,
          dateKey: string,
          openingFloat: number,
        ) => Promise<{
          cashSalesAmount: number;
          bankSalesAmount: number;
          cashExpenseAmount: number;
          cashRefundAmount: number;
          bankRefundAmount: number;
          expectedCash: number;
          pendingCashExpenses: number;
        }>;
      }
    ).calculate(prisma, branch.id, '2026-09-08', 1_000_000);

    expect(result).toEqual({
      cashSalesAmount: 650_000,
      bankSalesAmount: 300_000,
      cashExpenseAmount: 125_000,
      cashRefundAmount: 50_000,
      bankRefundAmount: 30_000,
      expectedCash: 1_475_000,
      pendingCashExpenses: 2,
    });
  });

  it('requires an explanation when the counted amount is different', async () => {
    const current = cashSession(CashSessionStatus.OPEN);
    const prisma = {
      ...financialPrisma(),
      storeBranch: { findMany: jest.fn().mockResolvedValue([branch]) },
      cashSession: { findUnique: jest.fn().mockResolvedValue(current) },
    };
    const service = new CashSessionsService(prisma as unknown as PrismaService);

    await expect(
      service.close(1, 'ADMIN', current.id, { actualCash: 1_350_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not approve a cash session while cash expenses are pending', async () => {
    const current = cashSession(CashSessionStatus.PENDING_REVIEW);
    const prisma = {
      ...financialPrisma({ pendingExpenses: 1 }),
      cashSession: { findUnique: jest.fn().mockResolvedValue(current) },
    };
    const service = new CashSessionsService(prisma as unknown as PrismaService);

    await expect(service.approve(1, current.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires recounting when revenue changes after the session was closed', async () => {
    const current = cashSession(CashSessionStatus.PENDING_REVIEW);
    const prisma = {
      ...financialPrisma({ cashSales: 550_000 }),
      cashSession: { findUnique: jest.fn().mockResolvedValue(current) },
    };
    const service = new CashSessionsService(prisma as unknown as PrismaService);

    await expect(service.approve(1, current.id, {})).rejects.toThrow(
      'Số liệu thu hoặc chi đã thay đổi sau khi đóng sổ',
    );
  });

  it('rejects a branch manager whose staff assignment no longer matches the managed branch', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          role: { name: 'BRANCH_MANAGER' },
          staffProfile: { branchId: 2 },
          managedBranch: branch,
        }),
      },
    };
    const service = new CashSessionsService(prisma as unknown as PrismaService);

    await expect(
      service.findAll(2, 'BRANCH_MANAGER', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reopen a daily cash session after its month is closed', async () => {
    const current = cashSession(CashSessionStatus.APPROVED);
    const prisma = {
      cashSession: { findUnique: jest.fn().mockResolvedValue(current) },
      monthlyClosePeriod: {
        findUnique: jest.fn().mockResolvedValue({ status: 'CLOSED' }),
      },
    };
    const service = new CashSessionsService(prisma as unknown as PrismaService);

    await expect(
      service.reopen(1, current.id, { reason: 'Kiểm tra lại tiền mặt' }),
    ).rejects.toThrow('Tháng 2026-09 đã chốt sổ');
  });
});
