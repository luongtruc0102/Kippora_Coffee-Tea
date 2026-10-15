import { BannersService } from './banners.service';

describe('BannersService', () => {
  function createPrismaMock() {
    const homepageBanner = {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    };
    const prisma = {
      homepageBanner,
      storeBranch: { findUnique: jest.fn().mockResolvedValue(null) },
      product: { findUnique: jest.fn().mockResolvedValue(null) },
      voucher: { findUnique: jest.fn().mockResolvedValue(null) },
      contentPage: { findUnique: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    return { prisma, homepageBanner };
  }

  it('chỉ trả banner đang bật và còn trong thời gian hiệu lực', async () => {
    const { prisma, homepageBanner } = createPrismaMock();
    homepageBanner.findMany.mockResolvedValue([
      {
        id: 1,
        eyebrow: 'KIPPORA',
        title: 'Món mới',
        subtitle: null,
        buttonLabel: 'Xem món',
        imageUrl: null,
        theme: 'AMBER',
        targetType: 'PRODUCT',
        customUrl: null,
        startsAt: null,
        endsAt: null,
        sortOrder: 1,
        product: { id: 9, name: 'Trà đào', isActive: true },
        voucher: null,
        contentPage: null,
        branch: null,
      },
    ]);
    const service = new BannersService(prisma as never);

    const result = await service.findPublic(2);

    expect(result).toHaveLength(1);
    expect(result[0].href).toBe('/menu?productId=9');
    expect(homepageBanner.findMany).toHaveBeenCalledTimes(1);
  });

  it('không cho lịch kết thúc trước thời gian bắt đầu', async () => {
    const { prisma } = createPrismaMock();
    const service = new BannersService(prisma as never);

    await expect(
      service.create(7, {
        title: 'Ưu đãi cuối tuần',
        theme: 'AMBER',
        targetType: 'MENU',
        startsAt: '2026-09-20T10:00:00.000Z',
        endsAt: '2026-09-20T09:00:00.000Z',
      }),
    ).rejects.toThrow('Thời gian kết thúc phải sau thời gian bắt đầu');
  });

  it('không cho liên kết đến sản phẩm không tồn tại', async () => {
    const { prisma } = createPrismaMock();
    const service = new BannersService(prisma as never);

    await expect(
      service.create(7, {
        title: 'Món đang quảng bá',
        theme: 'COCOA',
        targetType: 'PRODUCT',
        productId: 999,
      }),
    ).rejects.toThrow('Sản phẩm không tồn tại');
  });

  it('tạo banner toàn hệ thống và ghi nhật ký Admin', async () => {
    const { prisma, homepageBanner } = createPrismaMock();
    homepageBanner.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 3, ...data }),
    );
    const service = new BannersService(prisma as never);

    const result = await service.create(7, {
      title: 'Khám phá Menu',
      subtitle: 'Chọn món yêu thích.',
      buttonLabel: 'Xem menu',
      theme: 'GREEN',
      targetType: 'MENU',
      sortOrder: 5,
    });

    expect(homepageBanner.create).toHaveBeenCalledWith({
      data: {
        eyebrow: null,
        title: 'Khám phá Menu',
        subtitle: 'Chọn món yêu thích.',
        buttonLabel: 'Xem menu',
        imageUrl: null,
        theme: 'GREEN',
        targetType: 'MENU',
        productId: null,
        voucherId: null,
        contentPageId: null,
        customUrl: null,
        branchId: null,
        startsAt: null,
        endsAt: null,
        isActive: true,
        sortOrder: 5,
        updatedById: 7,
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(3);
  });
});
