import { PricingService } from './pricing.service';

describe('PricingService', () => {
  function createPrismaMock() {
    const settings = {
      id: 1,
      pricingTargetMarginPercent: 60,
      pricingCostAlertPercent: 10,
      pricingRoundingStep: 1000,
    };
    const historyCreate = jest.fn().mockResolvedValue({ id: 91 });
    const tx = {
      productVariant: {
        update: jest.fn().mockResolvedValue({ id: 11, price: 38_000 }),
        findMany: jest.fn().mockResolvedValue([{ price: 38_000 }]),
      },
      product: { update: jest.fn().mockResolvedValue({ id: 3 }) },
      productPriceHistory: { create: historyCreate },
    };
    const prisma = {
      storeSettings: {
        upsert: jest.fn().mockResolvedValue(settings),
        update: jest.fn().mockResolvedValue(settings),
      },
      storeBranch: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 1, code: 'MAIN', name: 'Kippora - Q9' }]),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            productId: 3,
            size: 'M',
            price: 30_000,
            product: {
              name: 'Bạc Sỉu',
              category: { id: 1, name: 'Cà phê' },
            },
            recipeIngredients: [
              {
                ingredientId: 8,
                quantity: 10,
                ingredient: { name: 'Hạt cà phê rang', unit: 'GRAM' },
              },
            ],
          },
        ]),
      },
      inventoryLot: {
        findMany: jest.fn().mockImplementation((args: { where: object }) =>
          'status' in args.where
            ? Promise.resolve([
                {
                  id: 71,
                  branchId: 1,
                  ingredientId: 8,
                  quantity: 100,
                  reservedQuantity: 0,
                  unitCost: 1500,
                  expiresAt: new Date('2026-12-31T00:00:00.000Z'),
                  receivedAt: new Date('2026-09-01T00:00:00.000Z'),
                },
              ])
            : Promise.resolve([
                {
                  branchId: 1,
                  ingredientId: 8,
                  unitCost: 1500,
                  receivedAt: new Date('2026-09-01T00:00:00.000Z'),
                },
              ]),
        ),
      },
      productPriceHistory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderItem: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ variantId: 11, _sum: { quantity: 20 } }]),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 92 }) },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    return { prisma, tx, historyCreate };
  }

  it('đề xuất giá theo giá lô FEFO và biên mục tiêu', async () => {
    const { prisma } = createPrismaMock();
    const service = new PricingService(prisma as never);

    const result = await service.getRecommendations({ branchId: 1 });

    expect(result.settings).toEqual({
      targetMarginPercent: 60,
      costIncreaseAlertPercent: 10,
      roundingStep: 1000,
    });
    expect(result.recommendations[0]).toEqual(
      expect.objectContaining({
        variantId: 11,
        productName: 'Bạc Sỉu',
        recipeCost: 15_000,
        currentPrice: 30_000,
        currentMarginPercent: 50,
        suggestedPrice: 38_000,
        priceDifference: 8_000,
        last30DaysQuantity: 20,
        estimatedMonthlyProfitCurrent: 300_000,
        estimatedMonthlyProfitSuggested: 460_000,
        estimatedMonthlyProfitDifference: 160_000,
        status: 'BELOW_TARGET',
      }),
    );
    expect(result.recommendations[0].ingredients[0]).toEqual(
      expect.objectContaining({
        ingredientName: 'Hạt cà phê rang',
        quantity: 10,
        costAmount: 15_000,
        isEstimated: false,
        isShort: false,
      }),
    );
  });

  it('chỉ Admin gọi luồng áp dụng mới đổi giá, đồng bộ giá gốc và lưu lịch sử', async () => {
    const { prisma, tx, historyCreate } = createPrismaMock();
    const service = new PricingService(prisma as never);

    const result = await service.applyPrice(5, 11, {
      branchId: 1,
      newPrice: 38_000,
      reason: 'Điều chỉnh theo giá vốn nguyên liệu mới',
    });

    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { price: 38_000 },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { price: 38_000 },
    });
    expect(historyCreate).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ historyId: 91, newMarginPercent: 60.53 }),
    );
  });
});
