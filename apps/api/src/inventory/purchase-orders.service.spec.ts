jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('./inventory.service', () => ({ InventoryService: jest.fn() }));

import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { InventoryService } from './inventory.service';
import { PurchaseOrdersService } from './purchase-orders.service';

describe('PurchaseOrdersService', () => {
  const branch = {
    id: 1,
    code: 'MAIN',
    name: 'Kippora Q9',
    managerId: 4,
  };
  const ingredient = {
    id: 7,
    name: 'Sữa tươi',
    unit: 'MILLILITER',
    isActive: true,
  };
  const creator = { id: 4, email: 'manager@kippora.vn', profile: null };

  function inventoryMock() {
    return {
      getScopedBranch: jest.fn().mockResolvedValue(branch),
      syncLowStockNotification: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('đề xuất đủ ngưỡng và 7 ngày dùng, đồng thời trừ hàng đang về', async () => {
    const prisma = {
      storeBranch: { findMany: jest.fn().mockResolvedValue([branch]) },
      ingredient: { findMany: jest.fn().mockResolvedValue([ingredient]) },
      inventoryStock: {
        findMany: jest.fn().mockResolvedValue([
          {
            ingredientId: 7,
            quantity: 55,
            reservedQuantity: 5,
            minimumLevel: 20,
          },
        ]),
      },
      inventoryMovement: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { ingredientId: 7, _sum: { quantityDelta: -140 } },
          ]),
      },
      purchaseOrderItem: {
        groupBy: jest.fn().mockResolvedValue([
          {
            ingredientId: 7,
            _sum: { orderedQuantity: 20, receivedQuantity: 10 },
          },
        ]),
      },
      stockReceiptItem: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PurchaseOrdersService(
      prisma as unknown as PrismaService,
      inventoryMock() as unknown as InventoryService,
    );

    const result = await service.getSuggestions(4, 'BRANCH_MANAGER');

    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        availableQuantity: 50,
        averageDailyUsage: 10,
        incomingQuantity: 10,
        targetQuantity: 90,
        suggestedQuantity: 30,
      }),
    );
  });

  it('nhận một phần sẽ tạo phiếu nhập hoàn tất, cộng kho và cập nhật tiến độ', async () => {
    const order = {
      id: 12,
      code: 'DH-20260911-000012',
      branchId: 1,
      branch,
      supplierId: 3,
      supplier: { id: 3, code: 'NCC-SUA', name: 'Sữa Việt' },
      createdById: 4,
      createdBy: creator,
      reviewedBy: null,
      status: 'ORDERED',
      totalCost: 200000,
      items: [
        {
          id: 20,
          ingredientId: 7,
          ingredient,
          orderedQuantity: 100,
          receivedQuantity: 20,
          unitCost: 2000,
          lineTotal: 200000,
          availableSnapshot: 10,
          minimumLevelSnapshot: 20,
          averageDailyUsage: 5,
          incomingSnapshot: 0,
          suggestedQuantity: 100,
        },
      ],
      receipts: [],
    };
    const completedReceipt = {
      id: 31,
      createdAt: new Date(),
      items: [{ id: 32, purchaseOrderItemId: 20 }],
    };
    const updatedOrder = {
      ...order,
      status: 'PARTIALLY_RECEIVED',
      items: [{ ...order.items[0], receivedQuantity: 60 }],
      receipts: [],
    };
    const tx = {
      stockReceipt: {
        create: jest.fn().mockResolvedValue(completedReceipt),
        update: jest.fn().mockResolvedValue({}),
      },
      purchaseOrderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ orderedQuantity: 100, receivedQuantity: 60 }]),
      },
      inventoryStock: {
        upsert: jest.fn().mockResolvedValue({
          id: 40,
          quantity: 90,
          reservedQuantity: 5,
        }),
      },
      inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
      inventoryLot: {
        create: jest.fn().mockResolvedValue({ id: 55, code: 'LOT-31-32' }),
      },
      purchaseOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedOrder),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      purchaseOrder: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const inventory = inventoryMock();
    const service = new PurchaseOrdersService(
      prisma as unknown as PrismaService,
      inventory as unknown as InventoryService,
    );

    const result = await service.receive(4, 'BRANCH_MANAGER', 12, {
      items: [{ purchaseOrderItemId: 20, quantity: 40 }],
    });

    expect(result.status).toBe('PARTIALLY_RECEIVED');
    expect(tx.inventoryStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { quantity: { increment: 40 } } }),
    );
    expect(tx.inventoryLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'LOT-31-32',
        stockReceiptItemId: 32,
        quantity: 40,
      }),
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      // Jest's asymmetric matcher is typed as any.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        stockReceiptId: 31,
        type: 'RECEIVE',
        quantityDelta: 40,
      }),
    });
    expect(inventory.syncLowStockNotification).toHaveBeenCalledWith(tx, 40);
  });

  it('không cho xác nhận nhận nhiều hơn số còn thiếu', async () => {
    const order = {
      id: 12,
      branchId: 1,
      branch,
      supplier: { name: 'Sữa Việt' },
      status: 'ORDERED',
      items: [
        {
          id: 20,
          ingredientId: 7,
          ingredient,
          orderedQuantity: 100,
          receivedQuantity: 80,
        },
      ],
    };
    const prisma = {
      purchaseOrder: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn(),
    };
    const service = new PurchaseOrdersService(
      prisma as unknown as PrismaService,
      inventoryMock() as unknown as InventoryService,
    );

    await expect(
      service.receive(4, 'BRANCH_MANAGER', 12, {
        items: [{ purchaseOrderItemId: 20, quantity: 21 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
