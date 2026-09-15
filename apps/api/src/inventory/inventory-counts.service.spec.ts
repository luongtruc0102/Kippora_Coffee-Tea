jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('./inventory.service', () => ({ InventoryService: jest.fn() }));

import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { InventoryService } from './inventory.service';
import { InventoryCountsService } from './inventory-counts.service';

describe('InventoryCountsService', () => {
  const branch = { id: 1, code: 'MAIN', name: 'Kippora Q9' };
  const creator = { id: 4, email: 'manager@kippora.vn', profile: null };
  const ingredient = {
    id: 7,
    name: 'Sữa tươi',
    unit: 'MILLILITER',
    isActive: true,
  };

  function inventoryMock() {
    return {
      getScopedBranch: jest.fn().mockResolvedValue(branch),
      syncLowStockNotification: jest.fn().mockResolvedValue(undefined),
      applyInventoryCountToLots: jest
        .fn()
        .mockResolvedValue([{ lotId: 44, quantityDelta: -5 }]),
    };
  }

  it('chụp tồn hệ thống và tính chênh lệch khi lập phiếu', async () => {
    const draft = {
      id: 12,
      code: 'KK-20260911-0012',
      branchId: 1,
      branch,
      createdById: 4,
      createdBy: creator,
      reviewedBy: null,
      status: 'DRAFT',
      countedAt: new Date('2026-09-11T02:00:00.000Z'),
      note: 'Kiểm kê đầu ngày',
      items: [
        {
          id: 20,
          ingredientId: 7,
          ingredient,
          expectedQuantity: 100,
          countedQuantity: 95,
          differenceQuantity: -5,
          reason: 'LOSS',
          note: null,
        },
      ],
    };
    const transaction = {
      inventoryCount: {
        create: jest.fn().mockResolvedValue({
          id: 12,
          createdAt: new Date('2026-09-11T02:00:00.000Z'),
          countedAt: draft.countedAt,
        }),
        update: jest.fn().mockResolvedValue(draft),
      },
    };
    const prisma = {
      ingredient: { findMany: jest.fn().mockResolvedValue([ingredient]) },
      inventoryStock: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ ingredientId: 7, quantity: 100 }]),
      },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const inventory = inventoryMock();
    const service = new InventoryCountsService(
      prisma as unknown as PrismaService,
      inventory as unknown as InventoryService,
    );

    const result = await service.create(4, 'BRANCH_MANAGER', {
      branchId: 1,
      countedAt: '2026-09-11T09:00:00+07:00',
      note: 'Kiểm kê đầu ngày',
      items: [{ ingredientId: 7, countedQuantity: 95, reason: 'LOSS' }],
    });

    expect(transaction.inventoryCount.create).toHaveBeenCalledWith({
      // Jest's asymmetric matcher is typed as any.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        branchId: 1,
        createdById: 4,
        items: {
          create: [
            {
              ingredientId: 7,
              expectedQuantity: 100,
              countedQuantity: 95,
              differenceQuantity: -5,
              reason: 'LOSS',
              note: null,
            },
          ],
        },
      }),
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({ differenceQuantity: -5 }),
    );
  });

  it('không cho gửi duyệt khi tồn đã đổi sau lần lưu', async () => {
    const count = {
      id: 12,
      code: 'KK-20260911-0012',
      branchId: 1,
      branch,
      createdBy: creator,
      reviewedBy: null,
      status: 'DRAFT',
      items: [
        {
          ingredientId: 7,
          expectedQuantity: 100,
          countedQuantity: 95,
          differenceQuantity: -5,
          ingredient,
        },
      ],
    };
    const prisma = {
      inventoryCount: { findUnique: jest.fn().mockResolvedValue(count) },
      inventoryStock: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ ingredientId: 7, quantity: 90 }]),
      },
    };
    const service = new InventoryCountsService(
      prisma as unknown as PrismaService,
      inventoryMock() as unknown as InventoryService,
    );

    await expect(
      service.submit(4, 'BRANCH_MANAGER', 12),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Admin duyệt sẽ áp đúng phần chênh lệch và ghi sổ kho', async () => {
    const pending = {
      id: 12,
      code: 'KK-20260911-0012',
      branchId: 1,
      branch,
      createdById: 4,
      createdBy: creator,
      reviewedBy: null,
      status: 'PENDING',
      items: [
        {
          id: 20,
          ingredientId: 7,
          ingredient,
          expectedQuantity: 100,
          countedQuantity: 95,
          differenceQuantity: -5,
          reason: 'LOSS',
          note: 'Thất thoát khi bảo quản',
        },
      ],
    };
    const approved = {
      ...pending,
      status: 'APPROVED',
      reviewedBy: { id: 1, email: 'admin@kippora.vn', profile: null },
      reviewedAt: new Date(),
      reviewNote: 'Đã đối chiếu',
    };
    const transaction = {
      inventoryCount: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(approved),
      },
      inventoryStock: {
        findUnique: jest.fn().mockResolvedValue({
          id: 30,
          quantity: 90,
          reservedQuantity: 10,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 30,
          quantity: 85,
          reservedQuantity: 10,
        }),
      },
      inventoryMovement: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      inventoryCount: { findUnique: jest.fn().mockResolvedValue(pending) },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const inventory = inventoryMock();
    const service = new InventoryCountsService(
      prisma as unknown as PrismaService,
      inventory as unknown as InventoryService,
    );

    await service.approve(1, 12, { reviewNote: 'Đã đối chiếu' });

    expect(transaction.inventoryStock.updateMany).toHaveBeenCalledWith({
      where: { id: 30, reservedQuantity: 10, quantity: { gte: 15 } },
      data: { quantity: { increment: -5 } },
    });
    expect(transaction.inventoryMovement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          inventoryCountId: 12,
          lotId: 44,
          type: 'ADJUST',
          quantityDelta: -5,
          quantityAfter: 85,
        }),
      ],
    });
    expect(inventory.syncLowStockNotification).toHaveBeenCalledWith(
      transaction,
      30,
    );
    expect(transaction.notification.create).toHaveBeenCalledWith({
      // Jest's asymmetric matcher is typed as any.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        userId: 4,
        type: 'INVENTORY_COUNT_APPROVED',
      }),
    });
  });

  it('bắt buộc có lý do khi nguyên liệu bị chênh lệch', async () => {
    const prisma = {
      ingredient: { findMany: jest.fn().mockResolvedValue([ingredient]) },
      inventoryStock: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ ingredientId: 7, quantity: 100 }]),
      },
    };
    const service = new InventoryCountsService(
      prisma as unknown as PrismaService,
      inventoryMock() as unknown as InventoryService,
    );

    await expect(
      service.create(4, 'BRANCH_MANAGER', {
        branchId: 1,
        countedAt: '2026-09-11T09:00:00+07:00',
        items: [{ ingredientId: 7, countedQuantity: 95 }],
      }),
    ).rejects.toThrow('Vui lòng chọn lý do chênh lệch');
  });
});
