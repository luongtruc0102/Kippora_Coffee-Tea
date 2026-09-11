import {
  StaffLeaveScope,
  StaffLeaveStatus,
  StaffShiftCoverageStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

const MAX_CONSECUTIVE_SHIFTS = 16;

/**
 * Chia một lần chấm công đang mở thành từng ca liền nhau. Ca cũ luôn đóng đúng
 * giờ dự kiến; ca kế tiếp được mở đúng giờ nên không tạo đi trễ hoặc tăng ca giả.
 * Nếu không còn ca liền kề, lần chấm công cuối cũng tự đóng theo lịch.
 */
export async function synchronizeEmployeeAttendance(
  prisma: PrismaService,
  employeeId: number,
  branchId: number,
  reference = new Date(),
) {
  const openKey = `employee:${employeeId}`;

  for (let step = 0; step < MAX_CONSECUTIVE_SHIFTS; step += 1) {
    const current = await prisma.staffAttendance.findUnique({
      where: { openKey },
      select: {
        id: true,
        recordedById: true,
        scheduledShift: {
          select: { id: true, startAt: true, endAt: true },
        },
      },
    });
    if (!current?.scheduledShift) return;

    const boundary = current.scheduledShift.endAt;
    if (reference.getTime() < boundary.getTime()) return;

    const nextShift = await prisma.staffShift.findFirst({
      where: {
        employeeId,
        branchId,
        startAt: boundary,
        endAt: { gt: boundary },
        attendances: { none: {} },
        leaveRequests: {
          none: {
            status: StaffLeaveStatus.APPROVED,
            scope: StaffLeaveScope.FULL_SHIFT,
          },
        },
      },
      select: { id: true, startAt: true, endAt: true },
      orderBy: { endAt: 'asc' },
    });

    const coverage = nextShift
      ? null
      : await prisma.staffShiftCoverage.findFirst({
          where: {
            coveringEmployeeId: employeeId,
            branchId,
            status: StaffShiftCoverageStatus.ACCEPTED,
            startAt: boundary,
            endAt: { gt: boundary },
          },
          select: { id: true, endAt: true },
          orderBy: { endAt: 'asc' },
        });
    const closeAt = coverage?.endAt ?? boundary;
    if (reference.getTime() < closeAt.getTime()) return;

    const transitioned = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.staffAttendance.updateMany({
        where: { id: current.id, openKey },
        data: {
          clockOut: closeAt,
          autoClockOut: true,
          openKey: null,
        },
      });
      if (claimed.count !== 1) return false;

      if (coverage) {
        await transaction.staffShiftCoverage.updateMany({
          where: {
            id: coverage.id,
            status: StaffShiftCoverageStatus.ACCEPTED,
          },
          data: {
            status: StaffShiftCoverageStatus.COMPLETED,
            actualEndAt: closeAt,
          },
        });
      }

      if (nextShift) {
        await transaction.staffAttendance.create({
          data: {
            employeeId,
            branchId,
            recordedById: current.recordedById,
            scheduledShiftId: nextShift.id,
            clockIn: nextShift.startAt,
            autoClockIn: true,
            openKey,
          },
        });
      }
      return true;
    });

    if (!transitioned || !nextShift) return;
  }
}

/**
 * Khi người xin đến trễ đã điểm danh, kết thúc phần làm thay tại đúng thời điểm
 * họ có mặt. Nếu họ tới trước giờ dự kiến, người làm thay chỉ được tính tăng ca
 * đến thời điểm thực tế này; nếu tới sau, phần làm thay vẫn bị chặn ở giờ duyệt.
 */
export async function completeAcceptedCoverageForShift(
  prisma: PrismaService,
  targetShiftId: number,
  arrivalAt = new Date(),
) {
  const coverage = await prisma.staffShiftCoverage.findFirst({
    where: {
      status: StaffShiftCoverageStatus.ACCEPTED,
      leaveRequest: { staffShiftId: targetShiftId },
    },
    select: {
      id: true,
      coveringEmployeeId: true,
      startAt: true,
      endAt: true,
    },
  });
  if (!coverage) return;

  const actualEndAt = new Date(
    Math.max(
      coverage.startAt.getTime(),
      Math.min(arrivalAt.getTime(), coverage.endAt.getTime()),
    ),
  );
  const openKey = `employee:${coverage.coveringEmployeeId}`;
  const openAttendance = await prisma.staffAttendance.findUnique({
    where: { openKey },
    select: {
      id: true,
      scheduledShift: { select: { endAt: true } },
    },
  });

  await prisma.$transaction(async (transaction) => {
    if (
      openAttendance?.scheduledShift?.endAt.getTime() ===
      coverage.startAt.getTime()
    ) {
      await transaction.staffAttendance.updateMany({
        where: { id: openAttendance.id, openKey },
        data: {
          clockOut: actualEndAt,
          autoClockOut: true,
          openKey: null,
        },
      });
    }
    await transaction.staffShiftCoverage.updateMany({
      where: {
        id: coverage.id,
        status: StaffShiftCoverageStatus.ACCEPTED,
      },
      data: {
        status: StaffShiftCoverageStatus.COMPLETED,
        actualEndAt,
      },
    });
  });
}

/** Đồng bộ mọi ca đang mở của chi nhánh trước khi lập bảng công hoặc tính lương. */
export async function synchronizeBranchAttendances(
  prisma: PrismaService,
  branchId: number,
  reference = new Date(),
) {
  const openAttendances = await prisma.staffAttendance.findMany({
    where: { branchId, openKey: { not: null } },
    select: { employeeId: true },
  });

  for (const attendance of openAttendances) {
    await synchronizeEmployeeAttendance(
      prisma,
      attendance.employeeId,
      branchId,
      reference,
    );
  }
}
