import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('UsersService staff attendance', () => {
  const userFindUnique = jest.fn();
  const userFindFirst = jest.fn();
  const attendanceFindUnique = jest.fn();
  const attendanceCreate = jest.fn();
  const shiftFindFirst = jest.fn();
  const coverageFindFirst = jest.fn();

  const prisma = {
    user: {
      findUnique: userFindUnique,
      findFirst: userFindFirst,
    },
    staffAttendance: {
      findUnique: attendanceFindUnique,
      create: attendanceCreate,
    },
    staffShift: {
      findFirst: shiftFindFirst,
    },
    staffShiftCoverage: {
      findFirst: coverageFindFirst,
    },
  } as unknown as PrismaService;

  const fuzzySearch = {} as FuzzySearchService;
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
    coverageFindFirst.mockResolvedValue(null);
  });

  it('ghi nhận ca với đúng nhân viên và chi nhánh của trưởng', async () => {
    userFindUnique.mockResolvedValue(manager);
    userFindFirst.mockResolvedValue({ id: 20, isActive: true });
    attendanceFindUnique.mockResolvedValue(null);
    shiftFindFirst.mockResolvedValue({
      id: 41,
      startAt: new Date(),
      endAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });
    attendanceCreate.mockResolvedValue({
      id: 1,
      employeeId: 20,
      employee: {
        id: 20,
        email: 'staff@example.com',
        isActive: true,
        profile: { fullName: 'NV', phone: null, avatarUrl: null },
      },
    });

    await service.checkInBranchStaff(10, 20);

    const payload = JSON.stringify(attendanceCreate.mock.calls[0]);
    const shiftQuery = JSON.stringify(shiftFindFirst.mock.calls[0]);
    expect(payload).toContain('"employeeId":20');
    expect(payload).toContain('"branchId":2');
    expect(payload).toContain('"recordedById":10');
    expect(payload).toContain('"scheduledShiftId":41');
    expect(payload).toContain('"openKey":"employee:20"');
    expect(shiftQuery).toContain('"attendances":{"none":{}}');
  });

  it('không cho một nhân viên bắt đầu hai ca cùng lúc', async () => {
    userFindUnique.mockResolvedValue(manager);
    userFindFirst.mockResolvedValue({ id: 20, isActive: true });
    attendanceFindUnique.mockResolvedValue({ id: 1 });

    await expect(service.checkInBranchStaff(10, 20)).rejects.toThrow(
      'Nhân viên đang có một ca làm chưa kết thúc',
    );
    expect(attendanceCreate).not.toHaveBeenCalled();
  });

  it('cho nhân viên tự điểm danh tại đúng chi nhánh được phân công', async () => {
    userFindUnique.mockResolvedValue({
      id: 20,
      isActive: true,
      role: { name: 'STAFF' },
      staffProfile: { branchId: 2, branch: { id: 2, isActive: true } },
    });
    attendanceFindUnique.mockResolvedValue(null);
    shiftFindFirst.mockResolvedValue({
      id: 42,
      startAt: new Date(),
      endAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });
    attendanceCreate.mockResolvedValue({
      id: 2,
      employeeId: 20,
      employee: {
        id: 20,
        email: 'staff@example.com',
        isActive: true,
        profile: { fullName: 'NV', phone: null, avatarUrl: null },
      },
    });

    await service.checkInMyAttendance(20);

    const payload = JSON.stringify(attendanceCreate.mock.calls[0]);
    expect(payload).toContain('"employeeId":20');
    expect(payload).toContain('"branchId":2');
    expect(payload).toContain('"recordedById":20');
    expect(payload).toContain('"scheduledShiftId":42');
    expect(payload).toContain('"openKey":"employee:20"');
  });

  it('không cho nhân viên chưa được phân chi nhánh tự điểm danh', async () => {
    userFindUnique.mockResolvedValue({
      id: 20,
      isActive: true,
      role: { name: 'STAFF' },
      staffProfile: { branchId: null, branch: null },
    });

    await expect(service.checkInMyAttendance(20)).rejects.toThrow(
      'Nhân viên chưa được phân công chi nhánh',
    );
    expect(attendanceCreate).not.toHaveBeenCalled();
  });

  it('không cho điểm danh khi chưa tới 5 phút trước ca', async () => {
    userFindUnique.mockResolvedValue({
      id: 20,
      isActive: true,
      role: { name: 'STAFF' },
      staffProfile: { branchId: 2, branch: { id: 2, isActive: true } },
    });
    attendanceFindUnique.mockResolvedValue(null);
    shiftFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      startAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(service.checkInMyAttendance(20)).rejects.toThrow(
      'Chỉ được điểm danh từ',
    );
    expect(attendanceCreate).not.toHaveBeenCalled();
  });
});
