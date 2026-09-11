jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService management', () => {
  const paymentFindMany = jest.fn();
  const paymentFindUnique = jest.fn();
  const paymentUpdate = jest.fn();

  const prisma = {
    payment: {
      findMany: paymentFindMany,
      findUnique: paymentFindUnique,
      update: paymentUpdate,
    },
  } as unknown as PrismaService;

  const service = new PaymentsService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('trả kèm chi nhánh để Admin lọc và đối soát giao dịch', async () => {
    paymentFindMany.mockResolvedValue([]);

    await service.findAll();

    expect(paymentFindMany).toHaveBeenCalledWith({
      include: {
        refund: true,
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    fullName: true,
                    phone: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                address: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('yêu cầu mã giao dịch khi xác nhận chuyển khoản', async () => {
    paymentFindUnique.mockResolvedValue({
      id: 8,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
    });

    await expect(
      service.updateStatus(8, { status: 'PAID' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it('ghi nhận thời điểm và mã giao dịch khi thanh toán thành công', async () => {
    paymentFindUnique.mockResolvedValue({
      id: 8,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
    });
    paymentUpdate.mockResolvedValue({ id: 8, status: 'PAID' });

    await service.updateStatus(8, {
      status: 'PAID',
      transactionCode: 'BANK-20260829-001',
    });

    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 8 },
      data: {
        status: 'PAID',
        transactionCode: 'BANK-20260829-001',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        paidAt: expect.any(Date),
      },
    });
  });
});
