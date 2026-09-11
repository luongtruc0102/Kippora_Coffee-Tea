import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { InventoryService } from './inventory.service';
import { StockReceiptsService } from './stock-receipts.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('./inventory.service', () => ({
  InventoryService: class InventoryService {},
}));

describe('StockReceiptsService', () => {
  const createdBy = {
    id: 1,
    email: 'admin@kippora.vn',
    profile: {
      fullName: 'Admin',
      phone: '0901234567',
      avatarUrl: null,
    },
  };
  const getScopedBranch = jest.fn();
  const tx = {
    stockReceipt: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    stockReceiptItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    inventoryStock: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: { create: jest.fn() },
    inventoryLot: { create: jest.fn() },
  };
  const transaction = jest.fn((callback: (client: typeof tx) => unknown) =>
    callback(tx),
  );
  const prisma = {
    supplier: { findFirst: jest.fn() },
    ingredient: { count: jest.fn() },
    stockReceipt: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    $transaction: transaction,
  } as unknown as PrismaService;
  const inventoryService = {
    getScopedBranch,
  } as unknown as InventoryService;
  const service = new StockReceiptsService(prisma, inventoryService);

  beforeEach(() => {
    jest.clearAllMocks();
    getScopedBranch.mockResolvedValue({ id: 2 });
  });

  it('tạo phiếu ở trạng thái nháp và tính tổng tiền tại backend', async () => {
    (prisma.supplier.findFirst as jest.Mock).mockResolvedValue({ id: 4 });
    (prisma.ingredient.count as jest.Mock).mockResolvedValue(2);
    tx.stockReceipt.create.mockResolvedValue({
      id: 15,
      createdAt: new Date('2026-09-03T08:00:00.000Z'),
    });
    tx.stockReceipt.update.mockResolvedValue({
      id: 15,
      status: 'DRAFT',
      createdBy,
    });

    await service.create(1, 'ADMIN', {
      branchId: 2,
      supplierId: 4,
      items: [
        { ingredientId: 7, quantity: 2, unitCost: 30_000 },
        { ingredientId: 8, quantity: 3, unitCost: 20_000 },
      ],
    });

    const createPayload = JSON.stringify(tx.stockReceipt.create.mock.calls[0]);
    expect(createPayload).toContain('"totalCost":120000');
    expect(createPayload.match(/"lineTotal":60000/g)).toHaveLength(2);
    expect(tx.stockReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { code: 'PN-20260903-000015' },
      }),
    );
  });

  it('chặn nguyên liệu lặp trong cùng một phiếu', async () => {
    await expect(
      service.create(1, 'ADMIN', {
        branchId: 2,
        supplierId: 4,
        items: [
          { ingredientId: 7, quantity: 1, unitCost: 10_000 },
          { ingredientId: 7, quantity: 2, unitCost: 10_000 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('chỉ cộng tồn khi xác nhận phiếu nháp', async () => {
    const receipt = {
      id: 15,
      code: 'PN-20260903-000015',
      branchId: 2,
      status: 'DRAFT',
      createdBy,
      items: [
        {
          id: 21,
          ingredientId: 7,
          quantity: 4,
          unitCost: 2_000,
          batchCode: null,
          manufacturedAt: null,
          expiresAt: null,
          lotNote: null,
        },
      ],
    };
    (prisma.stockReceipt.findUnique as jest.Mock).mockResolvedValue(receipt);
    tx.stockReceipt.updateMany.mockResolvedValue({ count: 1 });
    tx.inventoryStock.upsert.mockResolvedValue({
      id: 20,
      quantity: 14,
      reservedQuantity: 2,
      minimumLevel: 5,
      lowStockNotifiedAt: null,
    });
    tx.inventoryLot.create.mockResolvedValue({ id: 50, code: 'LOT-15-21' });
    tx.stockReceipt.findUniqueOrThrow.mockResolvedValue({
      ...receipt,
      status: 'COMPLETED',
    });

    await service.complete(1, 'ADMIN', 15);

    expect(tx.inventoryStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { quantity: { increment: 4 } },
      }),
    );
    expect(tx.inventoryLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'LOT-15-21',
        ingredientId: 7,
        quantity: 4,
      }),
    });
    const movementPayload = JSON.stringify(
      tx.inventoryMovement.create.mock.calls[0],
    );
    expect(movementPayload).toContain('"stockReceiptId":15');
    expect(movementPayload).toContain('"type":"RECEIVE"');
    expect(movementPayload).toContain('"quantityDelta":4');
  });

  it('không thể xác nhận lại phiếu đã hoàn tất', async () => {
    (prisma.stockReceipt.findUnique as jest.Mock).mockResolvedValue({
      id: 15,
      branchId: 2,
      status: 'COMPLETED',
      createdBy,
      items: [],
    });

    await expect(service.complete(1, 'ADMIN', 15)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.inventoryStock.upsert).not.toHaveBeenCalled();
  });
});
