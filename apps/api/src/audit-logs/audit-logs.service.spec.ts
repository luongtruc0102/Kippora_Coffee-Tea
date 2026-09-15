import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from './audit-logs.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AuditLogsService', () => {
  const userFindUnique = jest.fn();
  const logFindMany = jest.fn();
  const logCount = jest.fn();
  const logGroupBy = jest.fn();
  const branchFindMany = jest.fn();
  const prisma = {
    user: { findUnique: userFindUnique },
    auditLog: {
      findMany: logFindMany,
      count: logCount,
      groupBy: logGroupBy,
    },
    storeBranch: { findMany: branchFindMany },
  } as unknown as PrismaService;
  const service = new AuditLogsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    logFindMany.mockResolvedValue([]);
    logCount.mockResolvedValue(0);
    logGroupBy.mockResolvedValue([]);
    branchFindMany.mockResolvedValue([]);
  });

  it('luôn khóa nhân viên trưởng trong đúng chi nhánh được phân công', async () => {
    userFindUnique.mockResolvedValue({
      isActive: true,
      role: { name: 'BRANCH_MANAGER' },
      staffProfile: { branchId: 2 },
      managedBranch: { id: 2 },
    });

    const result = await service.findAll(10, 'BRANCH_MANAGER', {
      branchId: 99,
      page: 1,
      limit: 30,
    });

    expect(logFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: 2 }),
      }),
    );
    expect(result.scopedBranchId).toBe(2);
    expect(branchFindMany).not.toHaveBeenCalled();
  });

  it('cho Admin lọc một chi nhánh và nhận danh sách chi nhánh', async () => {
    branchFindMany.mockResolvedValue([
      { id: 3, code: 'Q9', name: 'Kippora - Q9' },
    ]);

    const result = await service.findAll(1, 'ADMIN', {
      branchId: 3,
      page: 1,
      limit: 30,
    });

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(logFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: 3 }),
      }),
    );
    expect(result.branches).toHaveLength(1);
  });
});
