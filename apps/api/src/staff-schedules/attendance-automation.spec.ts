import { PrismaService } from '../prisma/prisma.service';
import { synchronizeEmployeeAttendance } from './attendance-automation';

describe('attendance automation', () => {
  const attendanceFindUnique = jest.fn();
  const shiftFindFirst = jest.fn();
  const coverageFindFirst = jest.fn();
  const attendanceUpdateMany = jest.fn();
  const attendanceCreate = jest.fn();
  const coverageUpdateMany = jest.fn();
  const transactionClient = {
    staffAttendance: {
      updateMany: attendanceUpdateMany,
      create: attendanceCreate,
    },
    staffShiftCoverage: { updateMany: coverageUpdateMany },
  };
  const transaction = jest.fn(
    async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  );
  const prisma = {
    staffAttendance: { findUnique: attendanceFindUnique },
    staffShift: { findFirst: shiftFindFirst },
    staffShiftCoverage: { findFirst: coverageFindFirst },
    $transaction: transaction,
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    attendanceUpdateMany.mockResolvedValue({ count: 1 });
    attendanceCreate.mockResolvedValue({ id: 102 });
    coverageFindFirst.mockResolvedValue(null);
    coverageUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('tự chia hai ca liền nhau tại đúng ranh giới', async () => {
    const boundary = new Date('2026-09-07T11:00:00.000Z');
    const nextEnd = new Date('2026-09-07T15:00:00.000Z');
    attendanceFindUnique
      .mockResolvedValueOnce({
        id: 101,
        recordedById: 20,
        scheduledShift: {
          id: 1,
          startAt: new Date('2026-09-07T05:00:00.000Z'),
          endAt: boundary,
        },
      })
      .mockResolvedValueOnce({
        id: 102,
        recordedById: 20,
        scheduledShift: { id: 2, startAt: boundary, endAt: nextEnd },
      });
    shiftFindFirst.mockResolvedValue({
      id: 2,
      startAt: boundary,
      endAt: nextEnd,
    });

    await synchronizeEmployeeAttendance(
      prisma,
      20,
      2,
      new Date('2026-09-07T11:10:00.000Z'),
    );

    expect(attendanceUpdateMany).toHaveBeenCalledWith({
      where: { id: 101, openKey: 'employee:20' },
      data: { clockOut: boundary, autoClockOut: true, openKey: null },
    });
    expect(attendanceCreate).toHaveBeenCalledWith({
      data: {
        employeeId: 20,
        branchId: 2,
        recordedById: 20,
        scheduledShiftId: 2,
        clockIn: boundary,
        autoClockIn: true,
        openKey: 'employee:20',
      },
    });
  });

  it('tự đóng đúng lịch khi không còn ca liền kề', async () => {
    const endAt = new Date('2026-09-07T15:00:00.000Z');
    attendanceFindUnique.mockResolvedValue({
      id: 102,
      recordedById: 20,
      scheduledShift: {
        id: 2,
        startAt: new Date('2026-09-07T11:00:00.000Z'),
        endAt,
      },
    });
    shiftFindFirst.mockResolvedValue(null);

    await synchronizeEmployeeAttendance(
      prisma,
      20,
      2,
      new Date('2026-09-07T15:30:00.000Z'),
    );

    expect(attendanceUpdateMany).toHaveBeenCalledWith({
      where: { id: 102, openKey: 'employee:20' },
      data: { clockOut: endAt, autoClockOut: true, openKey: null },
    });
    expect(attendanceCreate).not.toHaveBeenCalled();
  });

  it('không thay đổi ca vẫn còn trong thời gian làm', async () => {
    attendanceFindUnique.mockResolvedValue({
      id: 101,
      recordedById: 20,
      scheduledShift: {
        id: 1,
        startAt: new Date('2026-09-07T05:00:00.000Z'),
        endAt: new Date('2026-09-07T11:00:00.000Z'),
      },
    });

    await synchronizeEmployeeAttendance(
      prisma,
      20,
      2,
      new Date('2026-09-07T10:59:00.000Z'),
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(shiftFindFirst).not.toHaveBeenCalled();
  });

  it('giữ ca trước mở tới giờ làm thay đã được xác nhận', async () => {
    const boundary = new Date('2026-09-07T11:00:00.000Z');
    const coverageEnd = new Date('2026-09-07T12:00:00.000Z');
    attendanceFindUnique.mockResolvedValue({
      id: 101,
      recordedById: 20,
      scheduledShift: {
        id: 1,
        startAt: new Date('2026-09-07T05:00:00.000Z'),
        endAt: boundary,
      },
    });
    shiftFindFirst.mockResolvedValue(null);
    coverageFindFirst.mockResolvedValue({ id: 9, endAt: coverageEnd });

    await synchronizeEmployeeAttendance(
      prisma,
      20,
      2,
      new Date('2026-09-07T11:30:00.000Z'),
    );

    expect(attendanceUpdateMany).not.toHaveBeenCalled();
  });

  it('tự kết thúc phần làm thay tại giờ đã được duyệt', async () => {
    const boundary = new Date('2026-09-07T11:00:00.000Z');
    const coverageEnd = new Date('2026-09-07T12:00:00.000Z');
    attendanceFindUnique.mockResolvedValue({
      id: 101,
      recordedById: 20,
      scheduledShift: {
        id: 1,
        startAt: new Date('2026-09-07T05:00:00.000Z'),
        endAt: boundary,
      },
    });
    shiftFindFirst.mockResolvedValue(null);
    coverageFindFirst.mockResolvedValue({ id: 9, endAt: coverageEnd });

    await synchronizeEmployeeAttendance(
      prisma,
      20,
      2,
      new Date('2026-09-07T12:10:00.000Z'),
    );

    expect(attendanceUpdateMany).toHaveBeenCalledWith({
      where: { id: 101, openKey: 'employee:20' },
      data: {
        clockOut: coverageEnd,
        autoClockOut: true,
        openKey: null,
      },
    });
    expect(coverageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'COMPLETED',
          actualEndAt: coverageEnd,
        },
      }),
    );
  });
});
