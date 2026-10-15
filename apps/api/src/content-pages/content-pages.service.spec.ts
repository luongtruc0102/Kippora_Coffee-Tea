import { ContentPagesService } from './content-pages.service';

describe('ContentPagesService', () => {
  function createPrismaMock() {
    const contentPage = {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    };
    const prisma = {
      contentPage,
      auditLog: { create: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    return { prisma, contentPage };
  }

  it('điều hướng công khai chỉ lấy trang đã xuất bản ở header hoặc footer', async () => {
    const { prisma, contentPage } = createPrismaMock();
    const service = new ContentPagesService(prisma as never);

    await service.getNavigation();

    expect(contentPage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isPublished: true,
          OR: [{ showInHeader: true }, { showInFooter: true }],
        },
      }),
    );
  });

  it('không cho khách mở trang đang là bản nháp', async () => {
    const { prisma } = createPrismaMock();
    const service = new ContentPagesService(prisma as never);

    await expect(service.findPublishedBySlug('ban-nhap')).rejects.toThrow(
      'Trang này chưa được công khai',
    );
  });

  it('tự tạo đường dẫn không dấu và ghi nhật ký khi Admin thêm trang', async () => {
    const { prisma, contentPage } = createPrismaMock();
    contentPage.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 12, ...data }),
    );
    const service = new ContentPagesService(prisma as never);

    const result = await service.create(7, {
      title: 'Chính sách đổi trả',
      content: 'Nội dung chính sách đổi trả rõ ràng.',
      category: 'POLICY',
    });

    expect(contentPage.create).toHaveBeenCalledWith({
      data: {
        title: 'Chính sách đổi trả',
        slug: 'chinh-sach-doi-tra',
        summary: null,
        content: 'Nội dung chính sách đổi trả rõ ràng.',
        category: 'POLICY',
        isPublished: false,
        showInHeader: false,
        showInFooter: true,
        sortOrder: 0,
        updatedById: 7,
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(result.slug).toBe('chinh-sach-doi-tra');
  });

  it('không cho tạo hai trang trùng đường dẫn', async () => {
    const { prisma, contentPage } = createPrismaMock();
    contentPage.findFirst.mockResolvedValue({ id: 2 });
    const service = new ContentPagesService(prisma as never);

    await expect(
      service.create(7, {
        title: 'Về Kippora',
        content: 'Nội dung trang giới thiệu Kippora.',
        category: 'ABOUT',
      }),
    ).rejects.toThrow('Đường dẫn trang đã tồn tại');
  });
});
