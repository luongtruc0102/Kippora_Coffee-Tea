import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('InventoryService order flow', () => {
  const service = new InventoryService({} as PrismaService);

  function transaction(overrides: Record<string, unknown> = {}) {
    return {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      toppingRecipeIngredient: { findMany: jest.fn() },
      inventoryStock: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      inventoryLot: {
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      orderIngredientLotAllocation: {
        create: jest.fn(),
        update: jest.fn(),
      },
      orderItemRecipeIngredient: { createMany: jest.fn() },
      orderIngredientReservation: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      notification: { createMany: jest.fn() },
      user: { findMany: jest.fn() },
      ...overrides,
    };
  }

  it('giữ nguyên cơ chế cũ khi toàn bộ món chưa có công thức', async () => {
    const tx = transaction();
    tx.order.findUnique.mockResolvedValue({
      id: 1,
      inventoryState: 'NOT_TRACKED',
      items: [
        {
          id: 10,
          productName: 'Bạc Sỉu',
          size: 'M',
          quantity: 1,
          variant: { recipeIngredients: [] },
          toppings: [],
        },
      ],
    });

    await expect(service.reserveForOrder(tx as never, 1, 2, 3)).resolves.toBe(
      'NOT_TRACKED',
    );
    expect(tx.inventoryStock.updateMany).not.toHaveBeenCalled();
  });

  it('chặn nhận đơn nếu mới cấu hình công thức một phần', async () => {
    const tx = transaction();
    tx.order.findUnique.mockResolvedValue({
      id: 1,
      inventoryState: 'NOT_TRACKED',
      items: [
        {
          id: 10,
          productName: 'Bạc Sỉu',
          size: 'M',
          quantity: 1,
          variant: {
            recipeIngredients: [
              {
                ingredientId: 7,
                quantity: 20,
                ingredient: { name: 'Sữa', unit: 'MILLILITER' },
              },
            ],
          },
          toppings: [{ toppingId: 8, toppingName: 'Kem tươi' }],
        },
      ],
    });
    tx.toppingRecipeIngredient.findMany.mockResolvedValue([]);

    await expect(service.reserveForOrder(tx as never, 1, 2, 3)).rejects.toThrow(
      'Topping Kem tươi',
    );
    expect(tx.inventoryStock.updateMany).not.toHaveBeenCalled();
  });

  it('giữ đúng tổng định lượng theo số lượng món', async () => {
    const tx = transaction();
    tx.order.findUnique.mockResolvedValue({
      id: 1,
      inventoryState: 'NOT_TRACKED',
      items: [
        {
          id: 10,
          productName: 'Bạc Sỉu',
          size: 'M',
          quantity: 2,
          variant: {
            recipeIngredients: [
              {
                ingredientId: 7,
                quantity: 20,
                ingredient: { name: 'Sữa', unit: 'MILLILITER' },
              },
            ],
          },
          toppings: [],
        },
      ],
    });
    tx.inventoryStock.findUnique.mockResolvedValue({
      id: 12,
      quantity: 100,
      reservedQuantity: 0,
      minimumLevel: 10,
      lowStockNotifiedAt: null,
      ingredient: { name: 'Sữa', unit: 'MILLILITER' },
      branch: { code: 'MAIN', managerId: null },
    });
    tx.inventoryStock.updateMany.mockResolvedValue({ count: 1 });
    tx.inventoryStock.findUniqueOrThrow.mockResolvedValue({
      quantity: 100,
      reservedQuantity: 40,
    });
    tx.orderIngredientReservation.create.mockResolvedValue({ id: 50 });
    tx.inventoryLot.findMany.mockResolvedValue([
      {
        id: 60,
        code: 'LOT-60',
        quantity: 100,
        reservedQuantity: 0,
        unitCost: 2000,
      },
    ]);
    tx.inventoryLot.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.reserveForOrder(tx as never, 1, 2, 3)).resolves.toBe(
      'RESERVED',
    );
    expect(tx.inventoryStock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reservedQuantity: { increment: 40 } },
      }),
    );
    expect(tx.orderItemRecipeIngredient.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ totalQuantity: 40 })],
    });
    expect(tx.orderIngredientLotAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ lotId: 60, quantity: 40 }),
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { inventoryState: 'RESERVED' },
    });
  });

  it('không giữ nguyên liệu khi tồn khả dụng không đủ', async () => {
    const tx = transaction();
    tx.order.findUnique.mockResolvedValue({
      id: 1,
      inventoryState: 'NOT_TRACKED',
      items: [
        {
          id: 10,
          productName: 'Espresso',
          size: 'S',
          quantity: 2,
          variant: {
            recipeIngredients: [
              {
                ingredientId: 7,
                quantity: 10,
                ingredient: { name: 'Hạt cà phê', unit: 'GRAM' },
              },
            ],
          },
          toppings: [],
        },
      ],
    });
    tx.inventoryStock.findUnique.mockResolvedValue({
      id: 12,
      quantity: 20,
      reservedQuantity: 5,
      ingredient: { name: 'Hạt cà phê' },
    });

    await expect(
      service.reserveForOrder(tx as never, 1, 2, 3),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inventoryStock.updateMany).not.toHaveBeenCalled();
  });
});

describe('InventoryService stock settings', () => {
  it('chỉ cập nhật mức cảnh báo và không cho ghi đè số lượng tồn', async () => {
    const stockUpsert = jest.fn().mockResolvedValue({
      id: 12,
      quantity: 500,
      reservedQuantity: 20,
      minimumLevel: 80,
      lowStockNotifiedAt: null,
    });
    const transaction = {
      inventoryStock: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 12,
            quantity: 500,
            reservedQuantity: 20,
            minimumLevel: 50,
            lowStockNotifiedAt: null,
          })
          .mockResolvedValueOnce({
            id: 12,
            quantity: 500,
            reservedQuantity: 20,
            minimumLevel: 80,
            lowStockNotifiedAt: null,
            ingredient: { name: 'Sữa', unit: 'MILLILITER' },
            branch: { code: 'MAIN', managerId: null },
          }),
        upsert: stockUpsert,
        update: jest.fn(),
      },
      user: { findMany: jest.fn() },
      notification: { createMany: jest.fn() },
    };
    const prisma = {
      storeBranch: {
        findFirst: jest.fn().mockResolvedValue({ id: 2, code: 'MAIN' }),
      },
      ingredient: {
        findFirst: jest.fn().mockResolvedValue({ id: 7, unit: 'MILLILITER' }),
      },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    } as unknown as PrismaService;
    const service = new InventoryService(prisma);

    await service.updateMinimumLevel(1, 'ADMIN', {
      branchId: 2,
      ingredientId: 7,
      minimumLevel: 80,
    });

    const payload = JSON.stringify(stockUpsert.mock.calls[0]);
    expect(payload).toContain('"minimumLevel":80');
    expect(payload).not.toContain('"update":{"quantity"');
    expect(payload).not.toContain('"inventoryMovement"');
  });
});
