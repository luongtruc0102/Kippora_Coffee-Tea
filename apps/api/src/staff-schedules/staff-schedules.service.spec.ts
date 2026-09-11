import { PrismaService } from '../prisma/prisma.service';
import { StaffSchedulesService } from './staff-schedules.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('StaffSchedulesService', () => {
  const userFindUnique = jest.fn();
  const userFindFirst = jest.fn();
  const userFindMany = jest.fn();
  const branchFindUnique = jest.fn();
  const shiftFindFirst = jest.fn();
  const shiftFindMany = jest.fn();
  const shiftCreate = jest.fn();
  const shiftUpdate = jest.fn();
  const shiftDelete = jest.fn();
  const attendanceFindUnique = jest.fn();
  const attendanceFindMany = jest.fn();
  const attendanceFindFirst = jest.fn();
  const attendanceUpdate = jest.fn();
  const templateFindMany = jest.fn();
  const templateUpsert = jest.fn();
  const attendancePeriodFindUnique = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    user: {
      findUnique: userFindUnique,
      findFirst: userFindFirst,
      findMany: userFindMany,
    },
    storeBranch: { findUnique: branchFindUnique },
    staffShift: {
      findFirst: shiftFindFirst,
      findMany: shiftFindMany,
      create: shiftCreate,
      update: shiftUpdate,
      delete: shiftDelete,
    },
    staffAttendance: {
      findUnique: attendanceFindUnique,
      findMany: attendanceFindMany,
      findFirst: attendanceFindFirst,
      update: attendanceUpdate,
    },
    staffShiftTemplate: {
      findMany: templateFindMany,
      upsert: templateUpsert,
    },
    staffAttendancePeriod: { findUnique: attendancePeriodFindUnique },
    $transaction: transaction,
  } as unknown as PrismaService;

  const service = new StaffSchedulesService(prisma);
  const manager = {
    isActive: true,
    staffProfile: { branchId: 2 },
    role: { name: 'BRANCH_MANAGER' },
    managedBranch: { id: 2, code: 'Q1', name: 'Kippora Q1', isActive: true },
  };
  const selectedEmployee = {
    id: 20,
    email: 'staff@example.com',
    profile: {
      fullName: 'Nhân viên A',
      avatarUrl: null,
      phone: '0900000000',
    },
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    templateFindMany.mockResolvedValue([]);
    attendancePeriodFindUnique.mockResolvedValue(null);
    transaction.mockImplementation((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    );
  });

  it('trả lịch tuần đúng chi nhánh của trưởng', async () => {
    userFindUnique.mockResolvedValue(manager);
    userFindMany.mockResolvedValue([selectedEmployee]);
    shiftFindMany.mockResolvedValue([
      { id: 7, employeeId: 20, employee: selectedEmployee },
    ]);

    const result = await service.getWeek(10, 'BRANCH_MANAGER', '2026-09-01');

    expect(result.branch.id).toBe(2);
    expect(result.employees).toHaveLength(1);
    expect(result.shifts).toHaveLength(1);
    expect(result.templates).toEqual([
      expect.objectContaining({ period: 'MORNING', startTime: '06:00' }),
      expect.objectContaining({ period: 'AFTERNOON', startTime: '12:00' }),
      expect.objectContaining({ period: 'EVENING', startTime: '18:00' }),
    ]);
  });

  it('cho admin cập nhật đủ ba khung giờ không trùng nhau', async () => {
    branchFindUnique.mockResolvedValue({ id: 2 });
    templateUpsert.mockResolvedValue({ id: 1 });
    templateFindMany.mockResolvedValue([
      {
        id: 1,
        branchId: 2,
        period: 'MORNING',
        startTime: '07:00',
        endTime: '11:00',
      },
      {
        id: 2,
        branchId: 2,
        period: 'AFTERNOON',
        startTime: '11:00',
        endTime: '17:00',
      },
      {
        id: 3,
        branchId: 2,
        period: 'EVENING',
        startTime: '17:00',
        endTime: '23:00',
      },
    ]);

    const result = await service.updateTemplates({
      branchId: 2,
      templates: [
        { period: 'MORNING', startTime: '07:00', endTime: '11:00' },
        { period: 'AFTERNOON', startTime: '11:00', endTime: '17:00' },
        { period: 'EVENING', startTime: '17:00', endTime: '23:00' },
      ],
    });

    expect(templateUpsert).toHaveBeenCalledTimes(3);
    expect(result[2].endTime).toBe('23:00');
  });

  it('không cho admin cấu hình các khung ca trùng thời gian', async () => {
    branchFindUnique.mockResolvedValue({ id: 2 });

    await expect(
      service.updateTemplates({
        branchId: 2,
        templates: [
          { period: 'MORNING', startTime: '06:00', endTime: '13:00' },
          { period: 'AFTERNOON', startTime: '12:00', endTime: '18:00' },
          { period: 'EVENING', startTime: '18:00', endTime: '22:00' },
        ],
      }),
    ).rejects.toThrow('Các khung ca không được trùng thời gian');
    expect(templateUpsert).not.toHaveBeenCalled();
  });

  it('xếp ca và lưu người tạo lịch', async () => {
    userFindUnique.mockResolvedValue(manager);
    userFindFirst.mockResolvedValue({ id: 20 });
    shiftFindFirst.mockResolvedValue(null);
    shiftCreate.mockResolvedValue({
      id: 7,
      employeeId: 20,
      employee: selectedEmployee,
    });

    await service.create(10, {
      employeeId: 20,
      startAt: '2026-09-04T01:00:00.000Z',
      endAt: '2026-09-04T09:00:00.000Z',
      note: 'Quầy pha chế',
    });

    const payload = JSON.stringify(shiftCreate.mock.calls[0]);
    expect(payload).toContain('"employeeId":20');
    expect(payload).toContain('"branchId":2');
    expect(payload).toContain('"createdById":10');
    expect(payload).toContain('"note":"Quầy pha chế"');
  });

  it('khóa thay đổi lịch khi bảng công tháng đang chờ Admin duyệt', async () => {
    userFindUnique.mockResolvedValue(manager);
    userFindFirst.mockResolvedValue({ id: 20 });
    attendancePeriodFindUnique.mockResolvedValue({ status: 'PENDING' });

    await expect(
      service.create(10, {
        employeeId: 20,
        startAt: '2026-08-04T01:00:00.000Z',
        endAt: '2026-08-04T05:00:00.000Z',
      }),
    ).rejects.toThrow('đang chờ Admin duyệt');
    expect(shiftCreate).not.toHaveBeenCalled();
  });

  it('tự nối bản chấm công ngoài lịch khi xếp bổ sung ca trùng giờ', async () => {
    userFindUnique.mockResolvedValue(manager);
    userFindFirst.mockResolvedValue({ id: 20 });
    shiftFindFirst.mockResolvedValue(null);
    shiftCreate.mockResolvedValue({
      id: 7,
      employeeId: 20,
      employee: selectedEmployee,
    });
    attendanceFindFirst.mockResolvedValue({ id: 90 });
    attendanceUpdate.mockResolvedValue({ id: 90, scheduledShiftId: 7 });

    await service.create(10, {
      employeeId: 20,
      startAt: '2026-09-04T10:00:00.000Z',
      endAt: '2026-09-04T15:00:00.000Z',
    });

    expect(JSON.stringify(attendanceFindFirst.mock.calls[0])).toContain(
      '"scheduledShiftId":null',
    );
    expect(JSON.stringify(attendanceUpdate.mock.calls[0])).toContain(
      '"scheduledShiftId":7',
    );
  });

  it('không cho xếp hai ca trùng thời gian', async () => {
    userFindUnique.mockResolvedValue(manager);
    userFindFirst.mockResolvedValue({ id: 20 });
    shiftFindFirst.mockResolvedValue({ id: 6 });

    await expect(
      service.create(10, {
        employeeId: 20,
        startAt: '2026-09-04T01:00:00.000Z',
        endAt: '2026-09-04T09:00:00.000Z',
      }),
    ).rejects.toThrow('Nhân viên đã có ca làm trùng thời gian');
    expect(shiftCreate).not.toHaveBeenCalled();
  });

  it('chỉ mở điểm danh từ 5 phút trước ca', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T00:50:00.000Z'));
    userFindUnique.mockResolvedValue({
      id: 20,
      staffProfile: { branchId: 2 },
      isActive: true,
      role: { name: 'STAFF' },
    });
    attendanceFindUnique.mockResolvedValue(null);
    shiftFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 7,
      employeeId: 20,
      branchId: 2,
      startAt: new Date('2026-09-04T01:00:00.000Z'),
      endAt: new Date('2026-09-04T09:00:00.000Z'),
      employee: selectedEmployee,
    });

    const result = await service.getMyStatus(20);

    expect(result.canCheckIn).toBe(false);
    expect(result.checkInOpensAt?.toISOString()).toBe(
      '2026-09-04T00:55:00.000Z',
    );
    jest.useRealTimers();
  });

  it('tổng hợp ca vắng và ca đi trễ về sớm theo lịch', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-05T05:00:00.000Z'));
    userFindUnique.mockResolvedValue(manager);
    const employee = {
      id: 20,
      email: 'staff@example.com',
      profile: {
        fullName: 'Nhân viên A',
        avatarUrl: null,
        phone: '0900000000',
      },
      isActive: true,
    };
    shiftFindMany.mockResolvedValue([
      {
        id: 70,
        employeeId: 20,
        branchId: 2,
        startAt: new Date('2026-09-04T01:00:00.000Z'),
        endAt: new Date('2026-09-04T05:00:00.000Z'),
        employee,
        attendances: [],
        leaveRequests: [],
      },
      {
        id: 71,
        employeeId: 20,
        branchId: 2,
        startAt: new Date('2026-09-04T06:00:00.000Z'),
        endAt: new Date('2026-09-04T10:00:00.000Z'),
        employee,
        attendances: [
          {
            id: 90,
            employeeId: 20,
            branchId: 2,
            recordedById: 20,
            scheduledShiftId: 71,
            clockIn: new Date('2026-09-04T06:10:00.000Z'),
            clockOut: new Date('2026-09-04T09:00:00.000Z'),
            note: null,
            createdAt: new Date('2026-09-04T06:10:00.000Z'),
            updatedAt: new Date('2026-09-04T09:00:00.000Z'),
            employee,
            recordedBy: {
              id: 20,
              email: 'staff@example.com',
              profile: {
                fullName: 'Nhân viên A',
                avatarUrl: null,
                phone: '0900000000',
              },
            },
          },
        ],
        leaveRequests: [],
      },
    ]);
    attendanceFindMany.mockResolvedValue([]);

    const result = await service.getAttendanceReport(
      10,
      'BRANCH_MANAGER',
      '2026-09-04',
      '2026-09-04',
    );

    expect(result.summary.absentShifts).toBe(1);
    expect(result.summary.lateShifts).toBe(1);
    expect(result.summary.earlyLeaveShifts).toBe(1);
    expect(result.rows.map((row) => row.status)).toEqual(
      expect.arrayContaining(['ABSENT', 'LATE_AND_EARLY']),
    );
    jest.useRealTimers();
  });

  it('ghép bản chấm công cũ trùng giờ thay vì tạo thêm dòng vắng mặt', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T16:00:00.000Z'));
    userFindUnique.mockResolvedValue(manager);
    const employee = {
      id: 20,
      email: 'staff@example.com',
      profile: {
        fullName: 'Nhân viên A',
        avatarUrl: null,
        phone: '0900000000',
      },
      isActive: true,
    };
    shiftFindMany.mockResolvedValue([
      {
        id: 70,
        employeeId: 20,
        branchId: 2,
        startAt: new Date('2026-09-04T10:00:00.000Z'),
        endAt: new Date('2026-09-04T15:00:00.000Z'),
        employee,
        attendances: [],
        leaveRequests: [],
      },
    ]);
    attendanceFindMany.mockResolvedValue([
      {
        id: 90,
        employeeId: 20,
        branchId: 2,
        recordedById: 10,
        scheduledShiftId: null,
        clockIn: new Date('2026-09-04T10:14:00.000Z'),
        clockOut: new Date('2026-09-04T14:45:00.000Z'),
        note: 'Điều chỉnh giờ thực tế',
        createdAt: new Date('2026-09-04T10:14:00.000Z'),
        updatedAt: new Date('2026-09-04T14:45:00.000Z'),
        employee,
        recordedBy: {
          id: 10,
          email: 'manager@example.com',
          profile: {
            fullName: 'Trưởng ca',
            avatarUrl: null,
            phone: null,
          },
        },
      },
    ]);

    const result = await service.getAttendanceReport(
      10,
      'BRANCH_MANAGER',
      '2026-09-04',
      '2026-09-04',
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe('LATE_AND_EARLY');
    expect(result.summary.absentShifts).toBe(0);
    expect(result.summary.earlyLeaveShifts).toBe(1);
  });

  it('bắt buộc lưu người chỉnh và lý do khi sửa chấm công', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-05T05:00:00.000Z'));
    userFindUnique.mockResolvedValue(manager);
    attendanceFindFirst.mockResolvedValue({
      id: 90,
      clockOut: new Date('2026-09-04T09:00:00.000Z'),
    });
    attendanceUpdate.mockResolvedValue({
      id: 90,
      employee: selectedEmployee,
      recordedBy: {
        id: 10,
        email: 'manager@example.com',
        profile: { fullName: 'Trưởng ca', avatarUrl: null, phone: null },
      },
    });

    await service.updateAttendance(10, 90, {
      clockIn: '2026-09-04T01:00:00.000Z',
      clockOut: '2026-09-04T09:00:00.000Z',
      reason: 'Nhân viên quên kết thúc ca',
    });

    const payload = JSON.stringify(attendanceUpdate.mock.calls[0]);
    expect(payload).toContain('"where":{"id":90}');
    expect(payload).toContain('"note":"Nhân viên quên kết thúc ca"');
    expect(payload).toContain('"recordedById":10');
    jest.useRealTimers();
  });
});
