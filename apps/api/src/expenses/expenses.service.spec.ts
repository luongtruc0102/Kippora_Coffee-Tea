import { BadRequestException, ConflictException } from '@nestjs/common';
import { ExpenseStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import { ExpensesService } from './expenses.service';

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
  profile: {
    fullName: 'Nhân viên trưởng',
    phone: null,
    avatarUrl: null,
  },
};

function expense(status: ExpenseStatus, amount = 250_000) {
  return {
    id: 8,
    code: 'CP-202609-00008',
    branchId: branch.id,
    branch,
    createdById: person.id,
    createdBy: person,
    reviewedById: null,
    reviewedBy: null,
    category: 'UTILITIES' as const,
    amount,
    incurredOn: new Date('2026-09-08T00:00:00+07:00'),
    description: 'Tiền điện tháng 9',
    note: null,
    status,
    submittedAt: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('ExpensesService', () => {
  it('only includes approved expenses in the approved total', async () => {
    const prisma = {
      storeBranch: { findMany: jest.fn().mockResolvedValue([branch]) },
      branchExpense: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            expense(ExpenseStatus.APPROVED, 250_000),
            expense(ExpenseStatus.PENDING, 900_000),
          ]),
      },
    };
    const service = new ExpensesService(prisma as unknown as PrismaService);

    const result = await service.findAll(1, 'ADMIN', {});

    expect(result.summary.approvedAmount).toBe(250_000);
    expect(result.summary.pendingAmount).toBe(900_000);
    expect(result.summary.byCategory.UTILITIES).toBe(250_000);
  });

  it('requires a reason when Admin rejects an expense', async () => {
    const prisma = {
      branchExpense: {
        findUnique: jest.fn().mockResolvedValue(expense(ExpenseStatus.PENDING)),
      },
    };
    const service = new ExpensesService(prisma as unknown as PrismaService);

    await expect(
      service.review(1, 'ADMIN', 8, { decision: 'REJECT' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents submitting an expense that is no longer editable', async () => {
    const prisma = {
      storeBranch: { findMany: jest.fn().mockResolvedValue([branch]) },
      branchExpense: {
        findUnique: jest
          .fn()
          .mockResolvedValue(expense(ExpenseStatus.APPROVED)),
      },
    };
    const service = new ExpensesService(prisma as unknown as PrismaService);

    await expect(service.submit(1, 'ADMIN', 8)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('detects when another Admin reviewed the same expense first', async () => {
    const pending = expense(ExpenseStatus.PENDING);
    const transaction = {
      branchExpense: {
        findUnique: jest.fn().mockResolvedValue(pending),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      notification: { create: jest.fn() },
    };
    const prisma = {
      ...transaction,
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new ExpensesService(prisma as unknown as PrismaService);

    await expect(
      service.review(1, 'ADMIN', 8, { decision: 'APPROVE' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.notification.create).not.toHaveBeenCalled();
  });
});
