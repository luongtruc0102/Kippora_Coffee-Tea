import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('UsersService employee detail worked time', () => {
  const userFindUnique = jest.fn();
  const orderFindMany = jest.fn();
  const attendanceFindMany = jest.fn();
  const prisma = {
    user: { findUnique: userFindUnique },
    order: { findMany: orderFindMany },
    staffAttendance: { findMany: attendanceFindMany },
  } as unknown as PrismaService;
  const service = new UsersService(prisma, {} as FuzzySearchService);
  const employee = { id: 20, role: { name: 'STAFF' }, branch: { id: 2 } };

  beforeEach(() => {
    jest.resetAllMocks();
    userFindUnique.mockResolvedValue(employee);
    orderFindMany.mockResolvedValue([]);
    attendanceFindMany.mockResolvedValue([]);
  });

  it('sums completed shifts, including overnight shifts, across the employee history', async () => {
    attendanceFindMany.mockResolvedValue([
      {
        clockIn: new Date('2026-08-29T01:00:00Z'),
        clockOut: new Date('2026-08-29T02:30:00Z'),
      },
      {
        clockIn: new Date('2026-08-29T16:00:00Z'),
        clockOut: new Date('2026-08-30T00:00:25Z'),
      },
    ]);

    const result = await service.findOne(20);

    expect(result.totalWorkedSeconds).toBe(34225);
    expect(attendanceFindMany).toHaveBeenCalledWith({
      where: { employeeId: 20, clockOut: { not: null } },
      select: { clockIn: true, clockOut: true },
    });
  });

  it.each(['STAFF', 'BRANCH_MANAGER'])(
    'returns zero for %s with no completed shifts',
    async (role) => {
      userFindUnique.mockResolvedValue({ ...employee, role: { name: role } });
      expect((await service.findOne(20)).totalWorkedSeconds).toBe(0);
    },
  );

  it('does not count open shifts and clamps negative durations like the attendance table', async () => {
    attendanceFindMany.mockResolvedValue([
      { clockIn: new Date('2026-08-29T01:00:00Z'), clockOut: null },
      {
        clockIn: new Date('2026-08-29T02:00:00Z'),
        clockOut: new Date('2026-08-29T01:00:00Z'),
      },
      {
        clockIn: new Date('2026-08-29T01:00:00Z'),
        clockOut: new Date('2026-08-29T01:00:01.999Z'),
      },
    ]);
    expect((await service.findOne(20)).totalWorkedSeconds).toBe(1);
  });

  it.each(['USER', 'ADMIN'])(
    'does not query or expose worked time for %s',
    async (role) => {
      userFindUnique.mockResolvedValue({ ...employee, role: { name: role } });
      const result = await service.findOne(20);
      expect(attendanceFindMany).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('totalWorkedSeconds');
    },
  );

  it('keeps the purchase summary and recent orders unchanged', async () => {
    const order = {
      id: 91,
      totalPrice: '150000',
      status: 'COMPLETED',
      createdAt: new Date('2026-08-29T01:00:00Z'),
    };
    orderFindMany.mockResolvedValueOnce([order]).mockResolvedValueOnce([order]);
    const result = await service.findOne(20);
    expect(result.purchaseSummary).toEqual({
      totalOrders: 1,
      totalSpent: 150000,
      lastPurchaseAt: order.createdAt,
    });
    expect(result.recentOrders).toEqual([order]);
  });

  it('does not query attendance when the account does not exist', async () => {
    userFindUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(
      'Không tìm thấy người dùng',
    );
    expect(attendanceFindMany).not.toHaveBeenCalled();
  });
});
