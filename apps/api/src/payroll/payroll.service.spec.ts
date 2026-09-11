import { PrismaService } from '../prisma/prisma.service';
import { PayrollService } from './payroll.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('PayrollService role rates', () => {
  const branchFindUnique = jest.fn();
  const updateMany = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    storeBranch: { findUnique: branchFindUnique },
    staffProfile: { updateMany },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new PayrollService(prisma);
  const input = {
    branchId: 2,
    staff: { hourlyRate: 32000, overtimeMultiplier: 1.5 },
    manager: { hourlyRate: 40000, overtimeMultiplier: 2 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    branchFindUnique.mockResolvedValue({
      id: 2,
      code: 'Q9',
      name: 'Kippora Q9',
      isActive: true,
    });
    updateMany
      .mockResolvedValueOnce({ count: 5 })
      .mockResolvedValueOnce({ count: 1 });
    transaction.mockImplementation((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    );
  });

  it('updates active staff and branch managers separately', async () => {
    await expect(service.updateRoleRates(1, 'ADMIN', input)).resolves.toEqual(
      expect.objectContaining({ updated: { staff: 5, managers: 1 } }),
    );

    expect(updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          branchId: 2,
          user: { isActive: true, role: { name: 'STAFF' } },
        },
        data: input.staff,
      }),
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          branchId: 2,
          user: { isActive: true, role: { name: 'BRANCH_MANAGER' } },
        },
        data: input.manager,
      }),
    );
  });

  it('rejects bulk updates from non-admin users', async () => {
    await expect(
      service.updateRoleRates(10, 'BRANCH_MANAGER', input),
    ).rejects.toThrow('Chỉ ADMIN');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects payroll finalization from branch managers', async () => {
    await expect(service.finalize(10, 'BRANCH_MANAGER', 1)).rejects.toThrow(
      'Chỉ ADMIN được chốt bảng lương',
    );
  });

  it('rejects payroll payment confirmation from branch managers', async () => {
    await expect(
      service.markPaid(10, 'BRANCH_MANAGER', 1, { method: 'CASH' }),
    ).rejects.toThrow('Chỉ ADMIN được xác nhận thanh toán lương');
  });
});

describe('PayrollService attendance approval', () => {
  it('không cho Admin chốt lương khi bảng công tháng chưa được duyệt', async () => {
    const periodFindUnique = jest.fn().mockResolvedValue({
      id: 9,
      branchId: 2,
      status: 'DRAFT',
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-01T00:00:00.000Z'),
      attendancePeriod: null,
      branch: { id: 2, code: 'Q9', name: 'Kippora Q9', isActive: true },
      finalizedBy: null,
      paidBy: null,
      entries: [],
    });
    const branchFindUnique = jest.fn().mockResolvedValue({
      id: 2,
      code: 'Q9',
      name: 'Kippora Q9',
      isActive: true,
    });
    const service = new PayrollService({
      staffPayrollPeriod: { findUnique: periodFindUnique },
      storeBranch: { findUnique: branchFindUnique },
    } as unknown as PrismaService);

    await expect(service.finalize(1, 'ADMIN', 9)).rejects.toThrow(
      'Bảng công tháng này chưa được Admin duyệt',
    );
  });
});
