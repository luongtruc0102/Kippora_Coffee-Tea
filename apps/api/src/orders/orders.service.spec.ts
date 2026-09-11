jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { BadRequestException } from '@nestjs/common';
import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { VouchersService } from '../vouchers/vouchers.service';
import type { StoreSettingsService } from '../store-settings/store-settings.service';
import type { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from './orders.service';

describe('OrdersService COD order flow', () => {
  function createService(
    prisma: Record<string, unknown>,
    inventory?: Pick<
      InventoryService,
      'releaseOrder' | 'consumeOrder' | 'reserveForOrder'
    >,
  ) {
    return new OrdersService(
      prisma as unknown as PrismaService,
      {} as VouchersService,
      new FuzzySearchService(),
      {} as StoreSettingsService,
      (inventory ?? {
        releaseOrder: jest.fn(),
        consumeOrder: jest.fn(),
        reserveForOrder: jest.fn().mockResolvedValue('NOT_TRACKED'),
      }) as unknown as InventoryService,
    );
  }

  it('hủy đơn PENDING và hoàn lại điểm, voucher, thanh toán', async () => {
    const pendingOrder = {
      id: 12,
      userId: 3,
      status: 'PENDING',
      fulfillmentMethod: 'DELIVERY',
      loyaltyPointsUsed: 3000,
      voucherId: 7,
      appliedVouchers: [{ voucherId: 7 }, { voucherId: 9 }],
      payment: { status: 'PENDING' },
    };
    const cancelledOrder = {
      ...pendingOrder,
      status: 'CANCELLED',
      payment: { status: 'CANCELLED' },
    };
    const transaction = {
      order: {
        findFirst: jest.fn().mockResolvedValue(pendingOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(cancelledOrder),
      },
      customerProfile: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      voucher: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = createService(prisma);

    await expect(service.cancelMyOrder(3, 12, 'Đổi kế hoạch')).resolves.toEqual(
      cancelledOrder,
    );
    expect(transaction.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 12,
        status: 'PENDING',
        userId: 3,
      },
      data: {
        status: 'CANCELLED',
        cancelReason: 'Đổi kế hoạch',
        // Jest khai báo asymmetric matcher là any dù runtime kiểm tra đúng Date.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        cancelledAt: expect.any(Date),
      },
    });
    expect(transaction.customerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 3 },
      create: { userId: 3, loyaltyPoints: 3000 },
      update: { loyaltyPoints: { increment: 3000 } },
    });
    expect(transaction.voucher.updateMany).toHaveBeenCalledTimes(2);
    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: 12, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  });

  it('không cho user hủy đơn đã được xác nhận', async () => {
    const transaction = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 12,
          userId: 3,
          status: 'CONFIRMED',
          loyaltyPointsUsed: 0,
          voucherId: null,
          appliedVouchers: [],
          payment: { status: 'PENDING' },
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.cancelMyOrder(3, 12, 'Không còn nhu cầu'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mua lại chỉ dựng preview, không tạo hoặc cập nhật giỏ hàng', async () => {
    const createdAt = new Date('2026-08-20T10:00:00.000Z');
    const updatedAt = new Date('2026-08-20T10:05:00.000Z');
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 12,
          userId: 3,
          createdAt,
          updatedAt,
          items: [
            {
              id: 21,
              productId: 5,
              productName: 'Bạc Sỉu',
              variantId: 8,
              quantity: 2,
              product: {
                id: 5,
                name: 'Bạc Sỉu',
                description: null,
                imageUrl: null,
                isActive: true,
                category: { isActive: true },
              },
              variant: {
                id: 8,
                productId: 5,
                size: 'M',
                price: 30000,
                isActive: true,
              },
              toppings: [
                {
                  toppingId: 11,
                  topping: {
                    id: 11,
                    name: 'Kem tươi',
                    price: 5000,
                    isActive: true,
                    products: [{ productId: 5, toppingId: 11 }],
                  },
                },
              ],
            },
            {
              id: 22,
              productId: 6,
              productName: 'Trà cũ',
              variantId: 9,
              quantity: 1,
              product: {
                id: 6,
                name: 'Trà cũ',
                description: null,
                imageUrl: null,
                isActive: false,
                category: { isActive: true },
              },
              variant: {
                id: 9,
                productId: 6,
                size: 'S',
                price: 25000,
                isActive: true,
              },
              toppings: [],
            },
          ],
        }),
      },
    };
    const service = createService(prisma);

    const result = await service.reorderMyOrder(3, 12);

    expect(result).toEqual({
      sourceOrderId: 12,
      cart: {
        id: 0,
        userId: 3,
        items: [
          expect.objectContaining({
            id: 21,
            cartId: 0,
            productId: 5,
            variantId: 8,
            quantity: 2,
            unitPrice: 35000,
            lineTotal: 70000,
          }),
        ],
        totalPrice: 70000,
        createdAt,
        updatedAt,
      },
      selectedCartItemIds: [21],
      addedItemCount: 2,
      skippedItems: [
        {
          orderItemId: 22,
          productName: 'Trà cũ',
          reason: 'Sản phẩm hiện không còn khả dụng',
        },
      ],
    });
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { id: 12, userId: 3 },
      include: {
        items: {
          include: {
            product: { include: { category: true } },
            variant: true,
            toppings: {
              include: {
                topping: { include: { products: true } },
              },
            },
          },
        },
      },
    });
  });

  it('đánh dấu thanh toán COD là PAID khi hoàn tất đơn', async () => {
    const completedOrder = {
      id: 12,
      status: 'COMPLETED',
      payment: { method: 'COD', status: 'PAID' },
    };
    const transaction = {
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 12,
            userId: 3,
            totalPrice: 120000,
            fulfillmentMethod: 'DELIVERY',
            user: { role: { name: 'USER' } },
          })
          .mockResolvedValueOnce(completedOrder),
        update: jest.fn().mockResolvedValue({
          id: 12,
          userId: 3,
          status: 'COMPLETED',
          fulfillmentMethod: 'DELIVERY',
        }),
      },
      customerProfile: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 12,
          status: 'DELIVERING',
          fulfillmentMethod: 'DELIVERY',
        }),
      },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = createService(prisma);

    await expect(service.updateStatus(12, 'COMPLETED')).resolves.toEqual(
      completedOrder,
    );
    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: 12,
        method: 'COD',
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        // Jest khai báo asymmetric matcher là any dù runtime kiểm tra đúng Date.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        paidAt: expect.any(Date),
      },
    });
  });

  it('hủy đơn đã thanh toán, hoàn toàn bộ tiền và trả lượng nguyên liệu đang giữ', async () => {
    const processedAt = new Date('2026-09-09T03:00:00.000Z');
    const paidOrder = {
      id: 12,
      userId: 3,
      branchId: 1,
      status: 'CONFIRMED',
      channel: 'POS',
      inventoryState: 'RESERVED',
      posCustomerId: 4,
      loyaltyPointsUsed: 300,
      loyaltyPointsEarned: 1200,
      loyaltyPointsGrantedAt: processedAt,
      voucherId: 7,
      appliedVouchers: [{ voucherId: 7 }, { voucherId: 9 }],
      payment: { id: 5, status: 'PAID', amount: 120000 },
      refund: null,
      user: { role: { name: 'USER' } },
    };
    const refund = {
      id: 8,
      code: 'HT-D12-P5',
      orderId: 12,
      paymentId: 5,
      branchId: 1,
      amount: 120000,
      method: 'CASH',
      reason: 'Khách yêu cầu hủy',
      processedById: 1,
      processedAt,
      createdAt: processedAt,
      processedBy: {
        id: 1,
        email: 'admin@kippora.vn',
        profile: {
          fullName: 'Admin',
          phone: null,
          avatarUrl: null,
        },
      },
    };
    const refundedOrder = {
      ...paidOrder,
      status: 'CANCELLED',
      payment: { ...paidOrder.payment, status: 'REFUNDED' },
      refund,
      items: [],
    };
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue(paidOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(refundedOrder),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      paymentRefund: {
        create: jest.fn().mockResolvedValue(refund),
      },
      posCustomer: {
        findUnique: jest.fn().mockResolvedValue({ loyaltyPoints: 5000 }),
        update: jest.fn().mockResolvedValue({}),
      },
      customerProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      voucher: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: {
        create: jest.fn(),
      },
    };
    const auditLog = { create: jest.fn().mockResolvedValue({}) };
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(paidOrder) },
      auditLog,
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const inventory = {
      releaseOrder: jest.fn().mockResolvedValue(undefined),
      consumeOrder: jest.fn(),
      reserveForOrder: jest.fn().mockResolvedValue('NOT_TRACKED'),
    };
    const service = createService(prisma, inventory);

    const result = await service.cancelManagedOrder(1, 'ADMIN', 12, {
      reason: 'Khách yêu cầu hủy',
      refundMethod: 'CASH',
    });

    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: 'PAID' },
      data: { status: 'REFUNDED' },
    });
    expect(transaction.paymentRefund.create).toHaveBeenCalledWith({
      // Jest khai báo asymmetric matcher là any dù runtime kiểm tra đúng object.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        code: 'HT-D12-P5',
        orderId: 12,
        paymentId: 5,
        amount: 120000,
        method: 'CASH',
        reason: 'Khách yêu cầu hủy',
        processedById: 1,
      }),
    });
    expect(inventory.releaseOrder).toHaveBeenCalledWith(transaction, 12, 1, 1);
    expect(transaction.posCustomer.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { loyaltyPoints: 4100 },
    });
    expect(transaction.voucher.updateMany).toHaveBeenCalledTimes(2);
    expect(auditLog.create).toHaveBeenCalledWith({
      // Jest khai báo asymmetric matcher là any dù runtime kiểm tra đúng object.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        module: 'PAYMENT',
        action: 'REFUND_AND_CANCEL_ORDER',
      }),
    });
    expect(result.refund).toEqual(
      expect.objectContaining({
        amount: 120000,
        method: 'CASH',
        // Jest khai báo asymmetric matcher là any dù runtime kiểm tra đúng object.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        processedBy: expect.objectContaining({ fullName: 'Admin' }),
      }),
    );
  });

  it('không nhập trả kho khi đơn đã bắt đầu pha chế', async () => {
    const paidOrder = {
      id: 13,
      userId: 3,
      branchId: 1,
      status: 'PREPARING',
      channel: 'ONLINE',
      inventoryState: 'CONSUMED',
      posCustomerId: null,
      loyaltyPointsUsed: 0,
      loyaltyPointsEarned: 0,
      loyaltyPointsGrantedAt: null,
      voucherId: null,
      appliedVouchers: [],
      payment: { id: 6, status: 'PAID', amount: 80000 },
      refund: null,
      user: { role: { name: 'USER' } },
    };
    const refund = {
      id: 9,
      amount: 80000,
      processedBy: { id: 1, email: 'admin@kippora.vn', profile: null },
    };
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue(paidOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...paidOrder,
          status: 'CANCELLED',
          payment: { ...paidOrder.payment, status: 'REFUNDED' },
          refund,
        }),
      },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      paymentRefund: { create: jest.fn().mockResolvedValue(refund) },
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue({ loyaltyPoints: 100 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      posCustomer: { findUnique: jest.fn(), update: jest.fn() },
      voucher: { updateMany: jest.fn() },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(paidOrder) },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const inventory = {
      releaseOrder: jest.fn(),
      consumeOrder: jest.fn(),
      reserveForOrder: jest.fn().mockResolvedValue('NOT_TRACKED'),
    };
    const service = createService(prisma, inventory);

    await service.cancelManagedOrder(1, 'ADMIN', 13, {
      reason: 'Hoàn tiền sau khi đã pha',
      refundMethod: 'BANK_TRANSFER',
    });

    expect(inventory.releaseOrder).not.toHaveBeenCalled();
    expect(transaction.notification.create).toHaveBeenCalled();
  });

  it('bắt buộc chọn phương thức hoàn cho đơn đã thanh toán', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 14,
          branchId: 1,
          status: 'CONFIRMED',
          payment: { id: 7, status: 'PAID', amount: 50000 },
          refund: null,
        }),
      },
      $transaction: jest.fn(),
    };
    const service = createService(prisma);

    await expect(
      service.cancelManagedOrder(1, 'ADMIN', 14, {
        reason: 'Khách yêu cầu hủy',
      }),
    ).rejects.toThrow('Vui lòng chọn phương thức hoàn tiền');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
