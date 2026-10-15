import { PrismaService } from '../prisma/prisma.service';
import { StoreSettingsService } from './store-settings.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('StoreSettingsService status levels', () => {
  const storeSettingsUpsert = jest.fn();
  const storeBranchUpsert = jest.fn();
  const storeBranchFindFirst = jest.fn();
  const storeBranchFindMany = jest.fn();
  const storeBranchFindUnique = jest.fn();
  const storeBranchCreate = jest.fn();
  const storeBranchUpdate = jest.fn();
  const storeBranchCount = jest.fn();
  const prisma = {
    storeSettings: { upsert: storeSettingsUpsert },
    storeBranch: {
      upsert: storeBranchUpsert,
      findFirst: storeBranchFindFirst,
      findMany: storeBranchFindMany,
      findUnique: storeBranchFindUnique,
      create: storeBranchCreate,
      update: storeBranchUpdate,
      count: storeBranchCount,
    },
  } as unknown as PrismaService;

  const service = new StoreSettingsService(prisma);
  const now = new Date();

  function mockStatus(systemActive: boolean, branchActive: boolean) {
    storeSettingsUpsert.mockResolvedValue({
      id: 1,
      isAcceptingOrders: systemActive,
      deliveryEnabled: true,
      pickupEnabled: true,
      openingTime: '00:00',
      closingTime: '00:00',
      preparationMinutes: 10,
      maxDeliveryDistanceKm: 15,
      deliveryBaseDistanceKm: 3,
      deliveryBaseFee: 15000,
      deliveryFeePerKm: 5000,
      deliveryDiscountFirstThreshold: 300000,
      deliveryDiscountFirstAmount: 20000,
      deliveryDiscountSecondThreshold: 500000,
      deliveryDiscountSecondAmount: 40000,
      pauseReason: systemActive ? null : 'Bảo trì hệ thống',
      createdAt: now,
      updatedAt: now,
    });
    const branch = {
      id: 1,
      code: 'MAIN',
      name: 'Kippora - Chi nhánh chính',
      address: '78 Đ. Số 29, Hiệp Bình',
      phone: null,
      latitude: 10.8569371,
      longitude: 106.7465042,
      bankAccount: { id: 1, isActive: true },
      isActive: true,
      isAcceptingOrders: branchActive,
      pauseReason: branchActive ? null : 'Chi nhánh tạm nghỉ',
      createdAt: now,
      updatedAt: now,
    };

    storeBranchFindFirst.mockResolvedValue(branchActive ? branch : null);
    storeBranchUpsert.mockResolvedValue(branch);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Staff tạm nghỉ chỉ đóng nhận đơn của chi nhánh', async () => {
    mockStatus(true, false);

    const status = await service.getStatus();

    expect(status.isSystemActive).toBe(true);
    expect(status.isBranchAcceptingOrders).toBe(false);
    expect(status.isOpen).toBe(false);
    expect(status.unavailableScope).toBe('BRANCH');
  });

  it('Admin tạm ngưng sẽ đóng toàn hệ thống', async () => {
    mockStatus(false, true);

    const status = await service.getStatus();

    expect(status.isSystemActive).toBe(false);
    expect(status.isOpen).toBe(false);
    expect(status.unavailableScope).toBe('SYSTEM');
  });

  it('hệ thống và chi nhánh cùng hoạt động thì User được đặt hàng', async () => {
    mockStatus(true, true);

    const status = await service.getStatus();

    expect(status.isOpen).toBe(true);
    expect(status.deliveryAvailable).toBe(true);
    expect(status.pickupAvailable).toBe(true);
    expect(status.deliveryBaseFee).toBe(15000);
  });

  it('tính phí giao hàng theo chính sách lưu trong cài đặt', async () => {
    mockStatus(true, true);

    await expect(
      service.calculateDeliveryPricing(5.2, 300000),
    ).resolves.toEqual({
      deliveryBaseFee: 30000,
      deliveryDiscountAmount: 20000,
      deliveryFee: 10000,
    });
  });

  it('không giảm phí vượt quá phí giao hàng thực tế', async () => {
    mockStatus(true, true);

    await expect(service.calculateDeliveryPricing(2, 500000)).resolves.toEqual({
      deliveryBaseFee: 15000,
      deliveryDiscountAmount: 15000,
      deliveryFee: 0,
    });
  });

  it('chọn chi nhánh khác đang nhận đơn thay vì phụ thuộc MAIN', async () => {
    mockStatus(true, false);
    storeBranchFindFirst.mockResolvedValue({
      id: 2,
      code: 'SECOND',
      name: 'Kippora - Chi nhánh 2',
      address: '12 Nguyễn Huệ, Quận 1',
      phone: null,
      latitude: 10.7731,
      longitude: 106.703,
      bankAccount: null,
      isActive: true,
      isAcceptingOrders: true,
      pauseReason: null,
      createdAt: now,
      updatedAt: now,
    });

    const status = await service.getStatus();

    expect(status.isOpen).toBe(true);
    expect(status.branch.id).toBe(2);
  });

  it('kiểm tra lại đúng chi nhánh checkout đã chọn', async () => {
    mockStatus(true, true);
    storeBranchFindUnique.mockResolvedValue({
      id: 2,
      code: 'SECOND',
      name: 'Kippora - Chi nhánh 2',
      address: '12 Nguyễn Huệ, Quận 1',
      phone: null,
      latitude: 10.7731,
      longitude: 106.703,
      bankAccount: null,
      isActive: false,
      isAcceptingOrders: true,
      pauseReason: 'Chi nhánh đã bị khóa',
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.assertCanCheckout('PICKUP', undefined, 2),
    ).rejects.toThrow('Chi nhánh đã bị khóa');
  });

  it('không cho nhận đơn khi chi nhánh chưa cấu hình đầy đủ vị trí', async () => {
    mockStatus(true, true);
    storeBranchFindUnique.mockResolvedValue({
      id: 2,
      code: 'SECOND',
      name: 'Kippora - Chi nhánh 2',
      address: '12 Nguyễn Huệ, Quận 1',
      phone: null,
      latitude: null,
      longitude: null,
      bankAccount: { id: 2, isActive: true },
      isActive: true,
      isAcceptingOrders: true,
      pauseReason: null,
      createdAt: now,
      updatedAt: now,
    });

    const status = await service.getStatus(2);

    expect(status.isOpen).toBe(false);
    expect(status.unavailableScope).toBe('FULFILLMENT');
    expect(status.unavailableReason).toContain('tọa độ');
  });

  it('không cho chuyển khoản khi chi nhánh chưa có tài khoản ngân hàng', async () => {
    mockStatus(true, true);
    storeBranchFindUnique.mockResolvedValue({
      id: 2,
      code: 'SECOND',
      name: 'Kippora - Chi nhánh 2',
      address: '12 Nguyễn Huệ, Quận 1',
      phone: null,
      latitude: 10.7731,
      longitude: 106.703,
      bankAccount: null,
      isActive: true,
      isAcceptingOrders: true,
      pauseReason: null,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.assertCanCheckout('PICKUP', undefined, 2, 'BANK_TRANSFER'),
    ).rejects.toThrow('Chi nhánh chưa cấu hình tài khoản nhận chuyển khoản');
  });

  it('không cho tạo chi nhánh trùng mã', async () => {
    storeBranchFindUnique.mockResolvedValue({
      id: 1,
      code: 'MAIN',
    });

    await expect(
      service.createBranch({
        code: 'MAIN',
        name: 'Chi nhánh trùng',
      }),
    ).rejects.toThrow('Mã chi nhánh đã tồn tại');
  });

  it('không cho lưu vị trí khi thiếu một trong hai tọa độ', async () => {
    await expect(
      service.createBranch({
        code: 'Q1',
        name: 'Kippora - Quận 1',
        latitude: 10.77,
      }),
    ).rejects.toThrow('Vui lòng nhập đầy đủ cả vĩ độ và kinh độ');
  });

  it('trả danh sách cửa hàng công khai cùng trạng thái mở cửa', async () => {
    mockStatus(true, true);
    storeBranchFindMany.mockResolvedValue([
      {
        id: 1,
        code: 'MAIN',
        name: 'Kippora - Chi nhánh chính',
        address: '78 Đ. Số 29, Hiệp Bình',
        phone: '0123456789',
        latitude: 10.8569371,
        longitude: 106.7465042,
        isActive: true,
        isAcceptingOrders: true,
        pauseReason: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const locations = await service.getLocations();

    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({
      code: 'MAIN',
      latitude: 10.8569371,
      longitude: 106.7465042,
      isOpen: true,
      deliveryAvailable: true,
      pickupAvailable: true,
    });
  });

  it('không khóa chi nhánh chính khi chưa có chi nhánh khác đang hoạt động', async () => {
    storeBranchFindUnique.mockResolvedValue({
      id: 1,
      code: 'MAIN',
      name: 'Kippora - Chi nhánh chính',
      isActive: true,
    });
    storeBranchCount.mockResolvedValue(0);

    await expect(service.updateBranchActive(1, false)).rejects.toThrow(
      'Không thể khóa chi nhánh chính khi chưa có chi nhánh khác đang hoạt động',
    );
  });
});
