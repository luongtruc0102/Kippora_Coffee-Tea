import { ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('argon2', () => ({
  hash: jest.fn(),
}));

describe('UsersService branch manager scope', () => {
  const userFindUnique = jest.fn();
  const userFindMany = jest.fn();
  const userCreate = jest.fn();
  const userUpdate = jest.fn();
  const profileFindUnique = jest.fn();
  const roleFindUnique = jest.fn();
  const attendanceFindMany = jest.fn();

  const prisma = {
    user: {
      findUnique: userFindUnique,
      findMany: userFindMany,
      create: userCreate,
      update: userUpdate,
    },
    userProfile: { findUnique: profileFindUnique },
    role: {
      findUnique: roleFindUnique,
    },
    staffAttendance: {
      findMany: attendanceFindMany,
    },
  } as unknown as PrismaService;

  const fuzzySearch = {
    search: jest.fn((items: unknown[]) => items),
  } as unknown as FuzzySearchService;

  const service = new UsersService(prisma, fuzzySearch);

  const manager = {
    isActive: true,
    staffProfile: { branchId: 2 },
    role: { name: 'BRANCH_MANAGER' },
    managedBranch: {
      id: 2,
      code: 'BRANCH_2',
      name: 'Chi nhánh 2',
      isActive: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('chỉ truy vấn Staff thuộc chi nhánh được quản lý', async () => {
    userFindUnique.mockResolvedValue(manager);
    userFindMany.mockResolvedValue([]);
    attendanceFindMany.mockResolvedValue([]);

    await service.findBranchStaff(10);

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          staffProfile: { branchId: 2 },
          role: { name: 'STAFF' },
        },
      }),
    );
  });

  it('tạo Staff và luôn gắn chi nhánh từ trưởng đang đăng nhập', async () => {
    userFindUnique.mockResolvedValueOnce(manager).mockResolvedValueOnce(null);
    profileFindUnique.mockResolvedValue(null);
    roleFindUnique.mockResolvedValue({ id: 3, name: 'STAFF' });
    (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
    userCreate.mockResolvedValue({
      id: 20,
      email: 'staff@example.com',
      isActive: true,
      role: { name: 'STAFF' },
      profile: {
        fullName: 'Nhan Vien Moi',
        phone: '0901234567',
        avatarUrl: null,
        address: null,
      },
      customerProfile: { loyaltyPoints: 0 },
      staffProfile: {
        branchId: 2,
        branch: { id: 2, code: 'BRANCH_2', name: 'Chi nhánh 2' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.createBranchStaff(10, {
      fullName: 'Nhan Vien Moi',
      email: 'STAFF@EXAMPLE.COM',
      phone: '0901234567',
      password: 'secret123',
    });

    const createPayload = JSON.stringify(userCreate.mock.calls[0]);

    expect(createPayload).toContain('"email":"staff@example.com"');
    expect(createPayload).toContain('"branchId":2');
    expect(createPayload).toContain('"roleId":3');
    expect(createPayload).toContain('"password":"hashed-password"');
  });

  it('chặn khóa Staff thuộc chi nhánh khác', async () => {
    userFindUnique.mockResolvedValueOnce(manager).mockResolvedValueOnce({
      id: 99,
      staffProfile: { branchId: 3 },
      role: { name: 'STAFF' },
    });

    await expect(
      service.updateBranchStaffStatus(10, 99, false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
