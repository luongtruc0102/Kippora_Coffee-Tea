jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('./inventory.service', () => ({ InventoryService: jest.fn() }));

import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { InventoryService } from './inventory.service';
import { InventoryLotsService } from './inventory-lots.service';

describe('InventoryLotsService', () => {
  const lot = {
    id: 8,
    code: 'LOT-2-8',
    batchCode: 'NCC-2409',
    branchId: 1,
    ingredientId: 7,
    ingredient: { id: 7, name: 'Sữa tươi', unit: 'MILLILITER' },
    branch: { id: 1, code: 'MAIN', name: 'Kippora Q9' },
    stockReceiptItem: null,
    manufacturedAt: null,
    expiresAt: null,
    receivedAt: new Date(),
    initialQuantity: 10,
    quantity: 10,
    reservedQuantity: 2,
    unitCost: 2_000,
    status: 'ACTIVE',
    isLegacy: false,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function setup() {
    const tx = {
      inventoryLot: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...lot, quantity: 7 }),
      },
      inventoryStock: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 30,
          quantity: 97,
          reservedQuantity: 2,
        }),
      },
      inventoryLotDisposal: { create: jest.fn().mockResolvedValue({}) },
      inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      inventoryLot: { findUnique: jest.fn().mockResolvedValue(lot) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const inventory = {
      getScopedBranch: jest.fn().mockResolvedValue(lot.branch),
      syncLowStockNotification: jest.fn().mockResolvedValue(undefined),
    };
    return {
      tx,
      inventory,
      service: new InventoryLotsService(
        prisma as unknown as PrismaService,
        inventory as unknown as InventoryService,
      ),
    };
  }

  it('không cho hủy phần nguyên liệu đang giữ cho đơn', async () => {
    const { service, tx } = setup();
    await expect(
      service.dispose(1, 'ADMIN', 8, { quantity: 9, reason: 'EXPIRED' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inventoryLot.updateMany).not.toHaveBeenCalled();
  });

  it('hủy lô sẽ trừ cả lô, tồn tổng và ghi đúng mã lô vào sổ kho', async () => {
    const { service, tx, inventory } = setup();
    await service.dispose(1, 'ADMIN', 8, {
      quantity: 3,
      reason: 'SPOILAGE',
      note: 'Bao bì rách',
    });
    expect(tx.inventoryLot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: { decrement: 3 } }),
      }),
    );
    expect(tx.inventoryStock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantity: { decrement: 3 } } }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lotId: 8,
        type: 'ADJUST',
        quantityDelta: -3,
      }),
    });
    expect(inventory.syncLowStockNotification).toHaveBeenCalledWith(tx, 30);
  });
});
