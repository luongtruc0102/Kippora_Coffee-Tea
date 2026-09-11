import { PrismaService } from '../prisma/prisma.service';
import { StaffLeavesService } from './staff-leaves.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('StaffLeavesService', () => {
  const userFindUnique = jest.fn();
  const shiftFindFirst = jest.fn();
  const requestFindUnique = jest.fn();
  const requestFindFirst = jest.fn();
  const requestCreate = jest.fn();
  const requestUpdate = jest.fn();
  const requestFindUniqueOrThrow = jest.fn();
  const attendanceFindFirst = jest.fn();
  const coverageFindFirst = jest.fn();
  const coverageCreate = jest.fn();
  const coverageUpdate = jest.fn();
  const notificationCreate = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    user: { findUnique: userFindUnique },
    staffShift: { findFirst: shiftFindFirst },
    staffLeaveRequest: {
      findUnique: requestFindUnique,
      findFirst: requestFindFirst,
    },
    staffAttendance: { findFirst: attendanceFindFirst },
    staffShiftCoverage: { findFirst: coverageFindFirst },
    $transaction: transaction,
  } as unknown as PrismaService;

  const service = new StaffLeavesService(prisma);
  const staff = {
    id: 20,
    email: 'staff@example.com',
    profile: { fullName: 'Nhân viên A' },
    isActive: true,
    role: { name: 'STAFF' },
    staffProfile: {
      branchId: 2,
      branch: {
        id: 2,
        code: 'Q1',
        name: 'Kippora Q1',
        isActive: true,
        managerId: 10,
      },
    },
  };
  const manager = {
    id: 10,
    isActive: true,
    staffProfile: { branchId: 2 },
    role: { name: 'BRANCH_MANAGER' },
    managedBranch: {
      id: 2,
      code: 'Q1',
      name: 'Kippora Q1',
      isActive: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    requestFindUnique.mockResolvedValue(null);
    transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          staffLeaveRequest: {
            create: requestCreate,
            update: requestUpdate,
            findUniqueOrThrow: requestFindUniqueOrThrow,
          },
          staffShiftCoverage: {
            create: coverageCreate,
            update: coverageUpdate,
          },
          notification: { create: notificationCreate },
        }),
    );
  });

  afterEach(() => jest.useRealTimers());

  it('không nhận đơn nghỉ báo trước nếu ca còn dưới 48 giờ', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T01:00:00.000Z'));
    userFindUnique.mockResolvedValue(staff);
    shiftFindFirst.mockResolvedValue({
      id: 70,
      startAt: new Date('2026-09-05T01:00:00.000Z'),
      endAt: new Date('2026-09-05T05:00:00.000Z'),
      _count: { attendances: 0 },
    });

    await expect(
      service.create(20, {
        staffShiftId: 70,
        type: 'PLANNED',
        reason: 'Có việc gia đình cần giải quyết',
      }),
    ).rejects.toThrow('ít nhất 48 giờ');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lưu nghỉ đột xuất và báo cho trưởng chi nhánh', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T01:00:00.000Z'));
    userFindUnique.mockResolvedValue(staff);
    shiftFindFirst.mockResolvedValue({
      id: 70,
      startAt: new Date('2026-09-04T02:00:00.000Z'),
      endAt: new Date('2026-09-04T06:00:00.000Z'),
      _count: { attendances: 0 },
    });
    requestCreate.mockResolvedValue({
      id: 99,
      status: 'PENDING',
      employee: {
        id: 20,
        email: 'staff@example.com',
        profile: {
          fullName: 'Nhân viên A',
          phone: null,
          avatarUrl: null,
        },
      },
      reviewedBy: null,
    });

    const result = await service.create(20, {
      staffShiftId: 70,
      type: 'EMERGENCY',
      reason: 'Bị sốt cao cần đi khám bệnh',
      evidenceUrl: 'http://localhost:4000/uploads/leave-evidence/test.pdf',
    });

    expect(result).toEqual(
      expect.objectContaining({ id: 99, status: 'PENDING' }),
    );
    const requestPayload = JSON.stringify(requestCreate.mock.calls[0]);
    expect(requestPayload).toContain('"employeeId":20');
    expect(requestPayload).toContain('"branchId":2');
    expect(requestPayload).toContain('"staffShiftId":70');
    expect(requestPayload).toContain('"type":"EMERGENCY"');
    const notificationPayload = JSON.stringify(
      notificationCreate.mock.calls[0],
    );
    expect(notificationPayload).toContain('"userId":10');
    expect(notificationPayload).toContain('"type":"LEAVE_REQUEST_CREATED"');
  });

  it('cho gửi yêu cầu về sớm sau khi nhân viên đã chấm công', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T03:00:00.000Z'));
    userFindUnique.mockResolvedValue(staff);
    shiftFindFirst.mockResolvedValue({
      id: 70,
      startAt: new Date('2026-09-04T02:00:00.000Z'),
      endAt: new Date('2026-09-04T06:00:00.000Z'),
      _count: { attendances: 1 },
    });
    requestCreate.mockResolvedValue({
      id: 100,
      scope: 'EARLY_LEAVE',
      requestedEndAt: new Date('2026-09-04T04:30:00.000Z'),
      status: 'PENDING',
      employee: {
        id: 20,
        email: 'staff@example.com',
        profile: { fullName: 'Nhân viên A', phone: null, avatarUrl: null },
      },
      reviewedBy: null,
    });

    await expect(
      service.create(20, {
        staffShiftId: 70,
        type: 'EMERGENCY',
        scope: 'EARLY_LEAVE',
        requestedEndAt: '2026-09-04T04:30:00.000Z',
        reason: 'Bị đau đầu cần về khám bệnh',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 100 }));

    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: 'EARLY_LEAVE',
          requestedEndAt: new Date('2026-09-04T04:30:00.000Z'),
        }),
      }),
    );
  });

  it('không nhận giờ xin về nằm ngoài khung ca', async () => {
    userFindUnique.mockResolvedValue(staff);
    shiftFindFirst.mockResolvedValue({
      id: 70,
      startAt: new Date('2026-09-04T02:00:00.000Z'),
      endAt: new Date('2026-09-04T06:00:00.000Z'),
      _count: { attendances: 1 },
    });

    await expect(
      service.create(20, {
        staffShiftId: 70,
        type: 'EMERGENCY',
        scope: 'EARLY_LEAVE',
        requestedEndAt: '2026-09-04T06:00:00.000Z',
        reason: 'Có việc đột xuất cần về sớm',
      }),
    ).rejects.toThrow('phải nằm trong khoảng thời gian của ca');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lưu giờ dự kiến đến khi nhân viên xin đến trễ', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T01:00:00.000Z'));
    userFindUnique.mockResolvedValue(staff);
    shiftFindFirst.mockResolvedValue({
      id: 70,
      startAt: new Date('2026-09-04T02:00:00.000Z'),
      endAt: new Date('2026-09-04T06:00:00.000Z'),
      _count: { attendances: 0 },
    });
    requestCreate.mockResolvedValue({
      id: 102,
      scope: 'LATE_ARRIVAL',
      requestedStartAt: new Date('2026-09-04T03:00:00.000Z'),
      status: 'PENDING',
      employee: {
        id: 20,
        email: 'staff@example.com',
        profile: { fullName: 'Nhân viên A', phone: null, avatarUrl: null },
      },
      reviewedBy: null,
      coverage: null,
    });

    await service.create(20, {
      staffShiftId: 70,
      type: 'EMERGENCY',
      scope: 'LATE_ARRIVAL',
      requestedStartAt: '2026-09-04T03:00:00.000Z',
      reason: 'Xe hỏng cần tới trễ một giờ',
    });

    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: 'LATE_ARRIVAL',
          requestedStartAt: new Date('2026-09-04T03:00:00.000Z'),
        }),
      }),
    );
  });

  it('bắt buộc trưởng nhập lý do khi từ chối', async () => {
    userFindUnique.mockResolvedValue(manager);
    requestFindFirst.mockResolvedValue({
      id: 99,
      employeeId: 20,
      status: 'PENDING',
      scope: 'FULL_SHIFT',
      staffShiftId: 70,
      staffShift: {
        startAt: new Date('2026-09-04T02:00:00.000Z'),
        endAt: new Date('2026-09-04T06:00:00.000Z'),
      },
    });

    await expect(
      service.review(10, 99, { action: 'REJECTED' }),
    ).rejects.toThrow('Cần nhập lý do');
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it('không duyệt nghỉ nếu nhân viên đã chấm công ca đó', async () => {
    userFindUnique.mockResolvedValue(manager);
    requestFindFirst.mockResolvedValue({
      id: 99,
      employeeId: 20,
      status: 'PENDING',
      scope: 'FULL_SHIFT',
      requestedEndAt: null,
      staffShiftId: 70,
      staffShift: {
        startAt: new Date('2026-09-04T02:00:00.000Z'),
        endAt: new Date('2026-09-04T06:00:00.000Z'),
      },
    });
    attendanceFindFirst.mockResolvedValue({ id: 88 });

    await expect(
      service.review(10, 99, { action: 'APPROVED' }),
    ).rejects.toThrow('đã chấm công');
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it('cho trưởng duyệt về sớm dù nhân viên đã chấm công', async () => {
    userFindUnique.mockResolvedValue(manager);
    requestFindFirst.mockResolvedValue({
      id: 101,
      employeeId: 20,
      status: 'PENDING',
      scope: 'EARLY_LEAVE',
      requestedEndAt: new Date('2026-09-04T04:30:00.000Z'),
      staffShiftId: 70,
      staffShift: {
        startAt: new Date('2026-09-04T02:00:00.000Z'),
        endAt: new Date('2026-09-04T06:00:00.000Z'),
      },
    });
    requestUpdate.mockResolvedValue({
      id: 101,
      status: 'APPROVED',
      scope: 'EARLY_LEAVE',
      requestedEndAt: new Date('2026-09-04T04:30:00.000Z'),
      employee: {
        id: 20,
        email: 'staff@example.com',
        profile: { fullName: 'Nhân viên A', phone: null, avatarUrl: null },
      },
      reviewedBy: {
        id: 10,
        email: 'manager@example.com',
        profile: { fullName: 'Trưởng ca', phone: null, avatarUrl: null },
      },
    });

    await expect(
      service.review(10, 101, { action: 'APPROVED' }),
    ).resolves.toEqual(expect.objectContaining({ status: 'APPROVED' }));

    expect(attendanceFindFirst).not.toHaveBeenCalled();
    expect(requestUpdate).toHaveBeenCalled();
  });

  it('tạo lời mời cho nhân viên ca trước khi duyệt đến trễ', async () => {
    userFindUnique.mockResolvedValue(manager);
    requestFindFirst.mockResolvedValue({
      id: 103,
      employeeId: 20,
      status: 'PENDING',
      scope: 'LATE_ARRIVAL',
      requestedStartAt: new Date('2026-09-08T03:00:00.000Z'),
      requestedEndAt: null,
      staffShiftId: 70,
      staffShift: {
        startAt: new Date('2026-09-08T02:00:00.000Z'),
        endAt: new Date('2026-09-08T06:00:00.000Z'),
      },
    });
    attendanceFindFirst.mockResolvedValue(null);
    shiftFindFirst.mockResolvedValue({ id: 69 });
    requestUpdate.mockResolvedValue({
      id: 103,
      status: 'APPROVED',
      scope: 'LATE_ARRIVAL',
      requestedStartAt: new Date('2026-09-08T03:00:00.000Z'),
      employee: {
        id: 20,
        email: 'staff@example.com',
        profile: { fullName: 'Nhân viên A', phone: null, avatarUrl: null },
      },
      reviewedBy: {
        id: 10,
        email: 'manager@example.com',
        profile: { fullName: 'Trưởng ca', phone: null, avatarUrl: null },
      },
      coverage: null,
    });

    await service.review(10, 103, {
      action: 'APPROVED',
      coveringEmployeeId: 21,
    });

    expect(coverageCreate).toHaveBeenCalledWith({
      data: {
        leaveRequestId: 103,
        branchId: 2,
        coveringEmployeeId: 21,
        assignedById: 10,
        startAt: new Date('2026-09-08T02:00:00.000Z'),
        endAt: new Date('2026-09-08T03:00:00.000Z'),
      },
    });
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 21,
          type: 'SHIFT_COVERAGE_ASSIGNED',
        }),
      }),
    );
  });

  it('cho nhân viên xác nhận làm thay trước khi ca bắt đầu', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-08T01:30:00.000Z'));
    userFindUnique.mockResolvedValue(staff);
    coverageFindFirst.mockResolvedValue({
      id: 8,
      status: 'PENDING',
      startAt: new Date('2026-09-08T02:00:00.000Z'),
      endAt: new Date('2026-09-08T03:00:00.000Z'),
      leaveRequest: {
        employee: {
          id: 22,
          email: 'late@example.com',
          profile: { fullName: 'Nhân viên đến trễ' },
        },
      },
    });
    coverageUpdate.mockResolvedValue({
      id: 8,
      leaveRequestId: 103,
      status: 'ACCEPTED',
    });

    await expect(
      service.respondCoverage(20, 8, { action: 'ACCEPTED' }),
    ).resolves.toEqual(expect.objectContaining({ id: 8, status: 'ACCEPTED' }));
    expect(coverageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      }),
    );
  });

  it('cho trưởng phân công người khác sau khi lời mời trước bị từ chối', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-08T01:00:00.000Z'));
    userFindUnique.mockResolvedValue(manager);
    requestFindFirst.mockResolvedValue({
      id: 103,
      employeeId: 20,
      status: 'APPROVED',
      scope: 'LATE_ARRIVAL',
      requestedStartAt: new Date('2026-09-08T03:00:00.000Z'),
      staffShift: {
        startAt: new Date('2026-09-08T02:00:00.000Z'),
        endAt: new Date('2026-09-08T06:00:00.000Z'),
      },
      coverages: [
        {
          id: 8,
          coveringEmployeeId: 21,
          status: 'DECLINED',
        },
      ],
    });
    shiftFindFirst.mockResolvedValue({ id: 68 });
    requestFindUniqueOrThrow.mockResolvedValue({
      id: 103,
      status: 'APPROVED',
      employee: {
        id: 20,
        email: 'staff@example.com',
        profile: { fullName: 'Nhân viên A', phone: null, avatarUrl: null },
      },
      reviewedBy: {
        id: 10,
        email: 'manager@example.com',
        profile: { fullName: 'Trưởng ca', phone: null, avatarUrl: null },
      },
      coverages: [
        {
          id: 9,
          status: 'PENDING',
          coveringEmployee: {
            id: 22,
            email: 'cover@example.com',
            profile: { fullName: 'Nhân viên B' },
          },
          assignedBy: {
            id: 10,
            email: 'manager@example.com',
            profile: { fullName: 'Trưởng ca' },
          },
        },
      ],
    });

    await expect(
      service.assignCoverage(10, 103, { coveringEmployeeId: 22 }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 103,
        coverage: expect.objectContaining({ id: 9, status: 'PENDING' }),
      }),
    );
    expect(coverageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaveRequestId: 103,
          coveringEmployeeId: 22,
        }),
      }),
    );
  });
});
