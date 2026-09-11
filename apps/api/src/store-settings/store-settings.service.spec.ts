import { PrismaService } from '../prisma/prisma.service';
import { StoreSettingsService } from './store-settings.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('StoreSettingsService status levels', () => {
  const storeSettingsUpsert = jest.fn();
  const storeBranchUpsert = jest.fn();
  const storeBranchFindFirst = jest.fn();
  const storeBranchFindUnique = jest.fn();
  const storeBranchCreate = jest.fn();
  const storeBranchUpdate = jest.fn();
  const storeBranchCount = jest.fn();
  const prisma = {
    storeSettings: { upsert: storeSettingsUpsert },
    storeBranch: {
      upsert: storeBranchUpsert,
      findFirst: storeBranchFindFirst,
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
      pauseReason: systemActive ? null : 'Bảo trì hệ thống',
      createdAt: now,
      updatedAt: now,
    });
    const branch = {
      id: 1,
      code: 'MAIN',
      name: 'Kippora - Chi nhánh chính',
      address: null,
      phone: null,
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
  });

  it('chọn chi nhánh khác đang nhận đơn thay vì phụ thuộc MAIN', async () => {
    mockStatus(true, false);
    storeBranchFindFirst.mockResolvedValue({
      id: 2,
      code: 'SECOND',
      name: 'Kippora - Chi nhánh 2',
      address: null,
      phone: null,
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
      address: null,
      phone: null,
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
