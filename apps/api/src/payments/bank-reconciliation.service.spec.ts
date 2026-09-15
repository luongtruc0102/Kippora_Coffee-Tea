/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BankReconciliationService } from './bank-reconciliation.service';

const account = {
  id: 2,
  branchId: 1,
  bankBin: '970415',
  accountNumber: '113366668888',
  isActive: true,
  branch: { id: 1, code: 'MAIN', name: 'Kippora - Q9' },
};

const dto = {
  bankBin: '970415',
  accountNumber: '113366668888',
  providerReference: 'BANK-001',
  amount: 56000,
  description: 'Thanh toan KIPABC123',
  occurredAt: '2026-09-15T10:00:00.000Z',
};

function mocks(options?: { amount?: number; existing?: object }) {
  const finalTransaction = {
    id: 7,
    status: options?.amount === 55000 ? 'AMOUNT_MISMATCH' : 'MATCHED',
    amount: options?.amount ?? 56000,
    bankAccount: account,
    matchedPayment: null,
    resolvedBy: null,
  };
  const bankTransactionFindUnique = jest
    .fn()
    .mockResolvedValueOnce(options?.existing ?? null)
    .mockResolvedValue(finalTransaction);
  const tx = {
    bankTransaction: {
      create: jest.fn().mockResolvedValue({ id: 7 }),
      update: jest.fn().mockResolvedValue({ id: 7 }),
    },
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    notification: { create: jest.fn().mockResolvedValue({ id: 9 }) },
  };
  const prisma = {
    bankTransaction: { findUnique: bankTransactionFindUnique },
    branchBankAccount: { findFirst: jest.fn().mockResolvedValue(account) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 1 }]) },
    notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    payment: {
      findUnique: jest.fn().mockResolvedValue({
        id: 5,
        method: 'BANK_TRANSFER',
        status: 'PENDING',
        amount: 56000,
        bankTransaction: null,
        order: { id: 70, branchId: 1, userId: 12, channel: 'ONLINE' },
      }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 10 }) },
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
  return { prisma, tx };
}

describe('BankReconciliationService', () => {
  it('tự xác nhận thanh toán khi mã, số tiền và chi nhánh đều khớp', async () => {
    const { prisma, tx } = mocks();
    const service = new BankReconciliationService(prisma as never);

    const result = await service.receiveTransaction(dto, null, dto);

    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 5, status: 'PENDING' }),
        data: expect.objectContaining({
          status: 'PAID',
          transactionCode: 'BANK-001',
        }),
      }),
    );
    expect(tx.notification.create).toHaveBeenCalled();
    expect(result.transaction).toEqual(
      expect.objectContaining({ status: 'MATCHED' }),
    );
  });

  it('giữ giao dịch lệch tiền để Admin xử lý và không đổi trạng thái đơn', async () => {
    const { prisma, tx } = mocks({ amount: 55000 });
    const service = new BankReconciliationService(prisma as never);

    const result = await service.receiveTransaction(
      { ...dto, amount: 55000 },
      null,
      dto,
    );

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.bankTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'AMOUNT_MISMATCH' }),
    });
    expect(result.transaction).toEqual(
      expect.objectContaining({ status: 'AMOUNT_MISMATCH' }),
    );
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('trả lại bản ghi cũ khi webhook gửi lặp cùng mã ngân hàng', async () => {
    const existing = { id: 4, status: 'MATCHED' };
    const { prisma } = mocks({ existing });
    const service = new BankReconciliationService(prisma as never);

    const result = await service.receiveTransaction(dto, null, dto);

    expect(result).toEqual({ transaction: existing, duplicateDelivery: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
