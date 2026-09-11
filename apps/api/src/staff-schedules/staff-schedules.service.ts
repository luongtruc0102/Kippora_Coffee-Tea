import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffShiftDto } from './dto/create-staff-shift.dto';
import { UpdateStaffShiftDto } from './dto/update-staff-shift.dto';
import { UpdateStaffShiftTemplatesDto } from './dto/update-staff-shift-templates.dto';
import { UpdateStaffAttendanceDto } from './dto/update-staff-attendance.dto';
import {
  StaffAttendancePeriodAction,
  StaffAttendancePeriodStatus,
  StaffLeaveScope,
  StaffLeaveStatus,
  StaffShiftPeriod,
} from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import {
  synchronizeBranchAttendances,
  synchronizeEmployeeAttendance,
} from './attendance-automation';
import { getPayrollMonthRange } from '../payroll/payroll.util';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import { ReviewAttendancePeriodDto } from './dto/review-attendance-period.dto';
import { ReopenAttendancePeriodDto } from './dto/reopen-attendance-period.dto';

export const CHECK_IN_EARLY_MINUTES = 5;
const VIETNAM_OFFSET = '+07:00';
const MAX_SHIFT_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_REPORT_RANGE_MS = 93 * 24 * 60 * 60 * 1000;
const DEFAULT_SHIFT_TEMPLATES = [
  { period: StaffShiftPeriod.MORNING, startTime: '06:00', endTime: '12:00' },
  {
    period: StaffShiftPeriod.AFTERNOON,
    startTime: '12:00',
    endTime: '18:00',
  },
  { period: StaffShiftPeriod.EVENING, startTime: '18:00', endTime: '22:00' },
] as const;

const attendancePeriodInclude = {
  branch: {
    select: { id: true, code: true, name: true, isActive: true },
  },
  submittedBy: {
    select: { id: true, email: true, ...personProfileSelect },
  },
  reviewedBy: {
    select: { id: true, email: true, ...personProfileSelect },
  },
  events: {
    include: {
      actor: {
        select: { id: true, email: true, ...personProfileSelect },
      },
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.StaffAttendancePeriodInclude;

type AttendancePeriodWithRelations = Prisma.StaffAttendancePeriodGetPayload<{
  include: typeof attendancePeriodInclude;
}>;

@Injectable()
export class StaffSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly shiftSelect = {
    id: true,
    employeeId: true,
    branchId: true,
    startAt: true,
    endAt: true,
    note: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
    employee: {
      select: {
        id: true,
        email: true,
        ...personProfileSelect,
        isActive: true,
      },
    },
  } as const;

  private readonly reportAttendanceSelect = {
    id: true,
    employeeId: true,
    branchId: true,
    recordedById: true,
    scheduledShiftId: true,
    clockIn: true,
    clockOut: true,
    autoClockIn: true,
    autoClockOut: true,
    note: true,
    createdAt: true,
    updatedAt: true,
    employee: {
      select: {
        id: true,
        email: true,
        ...personProfileSelect,
        isActive: true,
      },
    },
    recordedBy: {
      select: { id: true, email: true, ...personProfileSelect },
    },
  } as const;

  private serializeShift<
    T extends { employee: Parameters<typeof flattenPersonProfile>[0] },
  >(shift: T) {
    return { ...shift, employee: flattenPersonProfile(shift.employee) };
  }

  private serializeAttendance<
    T extends {
      employee: Parameters<typeof flattenPersonProfile>[0];
      recordedBy: Parameters<typeof flattenPersonProfile>[0] | null;
    },
  >(attendance: T) {
    return {
      ...attendance,
      employee: flattenPersonProfile(attendance.employee),
      recordedBy: attendance.recordedBy
        ? flattenPersonProfile(attendance.recordedBy)
        : null,
    };
  }

  private async getManagedBranch(managerUserId: number) {
    const manager = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      select: {
        isActive: true,
        staffProfile: { select: { branchId: true } },
        role: { select: { name: true } },
        managedBranch: {
          select: { id: true, code: true, name: true, isActive: true },
        },
      },
    });

    if (
      !manager ||
      !manager.isActive ||
      manager.role.name !== 'BRANCH_MANAGER' ||
      !manager.managedBranch ||
      manager.staffProfile?.branchId !== manager.managedBranch.id
    ) {
      throw new ForbiddenException(
        'Tài khoản chưa được phân công quản lý chi nhánh',
      );
    }

    if (!manager.managedBranch.isActive) {
      throw new ForbiddenException('Chi nhánh đang bị khóa');
    }

    return manager.managedBranch;
  }

  private async resolveViewBranch(
    viewerId: number,
    viewerRole: string,
    requestedBranchId?: number,
  ) {
    if (viewerRole === 'STAFF_SELF') {
      const staff = await this.prisma.user.findUnique({
        where: { id: viewerId },
        select: {
          isActive: true,
          role: { select: { name: true } },
          staffProfile: {
            select: {
              branch: {
                select: { id: true, code: true, name: true, isActive: true },
              },
            },
          },
        },
      });
      if (
        !staff ||
        !staff.isActive ||
        staff.role.name !== 'STAFF' ||
        !staff.staffProfile?.branch
      ) {
        throw new ForbiddenException(
          'Nhân viên chưa được phân công chi nhánh',
        );
      }
      return staff.staffProfile.branch;
    }

    if (viewerRole === 'BRANCH_MANAGER') {
      return this.getManagedBranch(viewerId);
    }

    if (viewerRole !== 'ADMIN') {
      throw new ForbiddenException('Tài khoản không có quyền xem lịch làm');
    }

    if (!requestedBranchId) {
      throw new BadRequestException('Vui lòng chọn chi nhánh cần xem lịch');
    }

    const branch = await this.prisma.storeBranch.findUnique({
      where: { id: requestedBranchId },
      select: { id: true, code: true, name: true, isActive: true },
    });

    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');
    return branch;
  }

  private getWeekRange(weekStart: string) {
    const start = new Date(`${weekStart}T00:00:00${VIETNAM_OFFSET}`);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Tuần làm việc không hợp lệ');
    }

    return {
      start,
      end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  private getReportRange(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00${VIETNAM_OFFSET}`);
    const lastDay = new Date(`${endDate}T00:00:00${VIETNAM_OFFSET}`);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(lastDay.getTime()) ||
      lastDay < start
    ) {
      throw new BadRequestException('Khoảng ngày xem bảng công không hợp lệ');
    }

    const end = new Date(lastDay.getTime() + 24 * 60 * 60 * 1000);
    if (end.getTime() - start.getTime() > MAX_REPORT_RANGE_MS) {
      throw new BadRequestException('Mỗi lần chỉ xem tối đa 93 ngày chấm công');
    }

    return { start, end };
  }

  private attendancePeriodStartFor(instant: Date) {
    const vietnamTime = new Date(instant.getTime() + 7 * 60 * 60 * 1000);
    return new Date(
      Date.UTC(vietnamTime.getUTCFullYear(), vietnamTime.getUTCMonth(), 1),
    );
  }

  private async assertAttendancePeriodEditable(
    branchId: number,
    instant: Date,
  ) {
    const periodStart = this.attendancePeriodStartFor(instant);
    const locked = await this.prisma.staffAttendancePeriod.findUnique({
      where: { branchId_periodStart: { branchId, periodStart } },
      select: { status: true },
    });
    if (
      locked?.status === StaffAttendancePeriodStatus.PENDING ||
      locked?.status === StaffAttendancePeriodStatus.APPROVED
    ) {
      throw new ConflictException(
        locked.status === StaffAttendancePeriodStatus.PENDING
          ? 'Bảng công tháng này đang chờ Admin duyệt nên tạm thời bị khóa'
          : 'Bảng công tháng này đã được duyệt; Admin cần mở lại trước khi sửa',
      );
    }
  }

  private serializeAttendancePeriod(period: AttendancePeriodWithRelations) {
    return {
      ...period,
      month: period.periodStart.toISOString().slice(0, 7),
      locked:
        period.status === StaffAttendancePeriodStatus.PENDING ||
        period.status === StaffAttendancePeriodStatus.APPROVED,
      canSubmit: period.periodEnd.getTime() <= Date.now(),
      submittedBy: period.submittedBy
        ? flattenPersonProfile(period.submittedBy)
        : null,
      reviewedBy: period.reviewedBy
        ? flattenPersonProfile(period.reviewedBy)
        : null,
      events: period.events.map((event) => ({
        ...event,
        actor: event.actor ? flattenPersonProfile(event.actor) : null,
      })),
    };
  }

  private async loadAttendancePeriod(id: number) {
    const period = await this.prisma.staffAttendancePeriod.findUnique({
      where: { id },
      include: attendancePeriodInclude,
    });
    if (!period) throw new NotFoundException('Không tìm thấy kỳ bảng công');
    return period;
  }

  async getAttendancePeriod(
    viewerId: number,
    viewerRole: string,
    month: string,
    branchId?: number,
  ) {
    const branch = await this.resolveViewBranch(viewerId, viewerRole, branchId);
    const range = getPayrollMonthRange(month);
    const period = await this.prisma.staffAttendancePeriod.findUnique({
      where: {
        branchId_periodStart: {
          branchId: branch.id,
          periodStart: range.periodStart,
        },
      },
      include: attendancePeriodInclude,
    });
    if (period) return this.serializeAttendancePeriod(period);
    return {
      id: null,
      branch,
      month,
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
      status: StaffAttendancePeriodStatus.DRAFT,
      revision: 0,
      submittedAt: null,
      submittedBy: null,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
      locked: false,
      canSubmit: range.periodEnd.getTime() <= Date.now(),
      events: [],
    };
  }

  async submitAttendancePeriod(managerUserId: number, month: string) {
    const branch = await this.getManagedBranch(managerUserId);
    const range = getPayrollMonthRange(month);
    if (range.rangeEnd.getTime() > Date.now()) {
      throw new BadRequestException(
        'Chỉ được gửi đối soát sau khi tháng chấm công đã kết thúc',
      );
    }

    await synchronizeBranchAttendances(this.prisma, branch.id, new Date());
    const [openAttendance, unresolvedLeave, payrollPeriod, existing] =
      await Promise.all([
        this.prisma.staffAttendance.findFirst({
          where: {
            branchId: branch.id,
            clockIn: { gte: range.rangeStart, lt: range.rangeEnd },
            clockOut: null,
          },
          select: { id: true },
        }),
        this.prisma.staffLeaveRequest.findFirst({
          where: {
            branchId: branch.id,
            status: {
              in: [StaffLeaveStatus.PENDING, StaffLeaveStatus.NEEDS_INFO],
            },
            staffShift: {
              startAt: { gte: range.rangeStart, lt: range.rangeEnd },
            },
          },
          select: { id: true },
        }),
        this.prisma.staffPayrollPeriod.findUnique({
          where: {
            branchId_periodStart: {
              branchId: branch.id,
              periodStart: range.periodStart,
            },
          },
          select: { id: true, status: true },
        }),
        this.prisma.staffAttendancePeriod.findUnique({
          where: {
            branchId_periodStart: {
              branchId: branch.id,
              periodStart: range.periodStart,
            },
          },
        }),
      ]);

    if (openAttendance) {
      throw new BadRequestException(
        'Còn ca chưa kết thúc trong tháng; cần đối soát trước khi gửi',
      );
    }
    if (unresolvedLeave) {
      throw new BadRequestException(
        'Còn đơn xin phép đang chờ xử lý trong tháng; cần xử lý trước khi gửi',
      );
    }
    if (
      payrollPeriod?.status !== undefined &&
      payrollPeriod.status !== 'DRAFT'
    ) {
      throw new ConflictException(
        'Kỳ lương đã chốt nên không thể gửi lại bảng công',
      );
    }
    if (
      existing?.status === StaffAttendancePeriodStatus.PENDING ||
      existing?.status === StaffAttendancePeriodStatus.APPROVED
    ) {
      throw new ConflictException(
        existing.status === StaffAttendancePeriodStatus.PENDING
          ? 'Bảng công đã được gửi và đang chờ Admin duyệt'
          : 'Bảng công đã được Admin duyệt',
      );
    }

    const periodId = await this.prisma.$transaction(async (transaction) => {
      const fromStatus = existing?.status ?? StaffAttendancePeriodStatus.DRAFT;
      const period = existing
        ? await transaction.staffAttendancePeriod.update({
            where: { id: existing.id },
            data: {
              status: StaffAttendancePeriodStatus.PENDING,
              revision: { increment: 1 },
              submittedAt: new Date(),
              submittedById: managerUserId,
              reviewedAt: null,
              reviewedById: null,
              reviewNote: null,
            },
          })
        : await transaction.staffAttendancePeriod.create({
            data: {
              branchId: branch.id,
              periodStart: range.periodStart,
              periodEnd: range.periodEnd,
              status: StaffAttendancePeriodStatus.PENDING,
              submittedAt: new Date(),
              submittedById: managerUserId,
            },
          });
      await transaction.staffAttendancePeriodEvent.create({
        data: {
          attendancePeriodId: period.id,
          action: StaffAttendancePeriodAction.SUBMITTED,
          fromStatus,
          toStatus: StaffAttendancePeriodStatus.PENDING,
          actorId: managerUserId,
        },
      });
      await transaction.staffPayrollPeriod.updateMany({
        where: {
          branchId: branch.id,
          periodStart: range.periodStart,
          status: 'DRAFT',
        },
        data: { attendancePeriodId: period.id },
      });
      return period.id;
    });
    const result = this.serializeAttendancePeriod(
      await this.loadAttendancePeriod(periodId),
    );
    await writeAuditLog(this.prisma, {
      actorId: managerUserId,
      branchId: branch.id,
      module: 'ATTENDANCE',
      action: 'SUBMIT_PERIOD',
      entityType: 'StaffAttendancePeriod',
      entityId: periodId,
      description: `Gửi bảng công tháng ${month} để Admin duyệt`,
      beforeData: { status: existing?.status ?? 'DRAFT' },
      afterData: { status: 'PENDING', revision: result.revision },
    });
    return result;
  }

  async reviewAttendancePeriod(
    adminUserId: number,
    periodId: number,
    dto: ReviewAttendancePeriodDto,
  ) {
    const current = await this.loadAttendancePeriod(periodId);
    if (current.status !== StaffAttendancePeriodStatus.PENDING) {
      throw new ConflictException(
        'Chỉ bảng công đang chờ duyệt mới được xử lý',
      );
    }
    const note = dto.note?.trim() || null;
    if (dto.action === 'RETURN' && (!note || note.length < 3)) {
      throw new BadRequestException('Cần nhập lý do trả lại bảng công');
    }
    const nextStatus =
      dto.action === 'APPROVE'
        ? StaffAttendancePeriodStatus.APPROVED
        : StaffAttendancePeriodStatus.RETURNED;
    const action =
      dto.action === 'APPROVE'
        ? StaffAttendancePeriodAction.APPROVED
        : StaffAttendancePeriodAction.RETURNED;

    await this.prisma.$transaction([
      this.prisma.staffAttendancePeriod.update({
        where: { id: current.id },
        data: {
          status: nextStatus,
          reviewedAt: new Date(),
          reviewedById: adminUserId,
          reviewNote: note,
        },
      }),
      this.prisma.staffAttendancePeriodEvent.create({
        data: {
          attendancePeriodId: current.id,
          action,
          fromStatus: StaffAttendancePeriodStatus.PENDING,
          toStatus: nextStatus,
          actorId: adminUserId,
          note,
        },
      }),
      ...(current.submittedById
        ? [
            this.prisma.notification.create({
              data: {
                userId: current.submittedById,
                type:
                  dto.action === 'APPROVE'
                    ? 'ATTENDANCE_PERIOD_APPROVED'
                    : 'ATTENDANCE_PERIOD_RETURNED',
                title:
                  dto.action === 'APPROVE'
                    ? 'Bảng công đã được duyệt'
                    : 'Bảng công cần điều chỉnh',
                message:
                  dto.action === 'APPROVE'
                    ? `Bảng công ${current.periodStart.toISOString().slice(0, 7)} của ${current.branch.code} đã được Admin duyệt.`
                    : `Bảng công ${current.periodStart.toISOString().slice(0, 7)} của ${current.branch.code} đã được trả lại${note ? `: ${note}` : '.'}`,
              },
            }),
          ]
        : []),
    ]);
    const result = this.serializeAttendancePeriod(
      await this.loadAttendancePeriod(current.id),
    );
    await writeAuditLog(this.prisma, {
      actorId: adminUserId,
      branchId: current.branchId,
      module: 'ATTENDANCE',
      action:
        dto.action === 'APPROVE' ? 'APPROVE_PERIOD' : 'RETURN_PERIOD',
      entityType: 'StaffAttendancePeriod',
      entityId: current.id,
      description:
        dto.action === 'APPROVE'
          ? `Duyệt bảng công tháng ${result.month}`
          : `Trả lại bảng công tháng ${result.month}`,
      beforeData: { status: current.status, reviewNote: current.reviewNote },
      afterData: { status: result.status, reviewNote: result.reviewNote },
    });
    return result;
  }

  async reopenAttendancePeriod(
    adminUserId: number,
    periodId: number,
    dto: ReopenAttendancePeriodDto,
  ) {
    const current = await this.loadAttendancePeriod(periodId);
    if (current.status !== StaffAttendancePeriodStatus.APPROVED) {
      throw new ConflictException('Chỉ bảng công đã duyệt mới có thể mở lại');
    }
    const lockedPayroll = await this.prisma.staffPayrollPeriod.findFirst({
      where: {
        attendancePeriodId: current.id,
        status: { in: ['FINALIZED', 'PAID'] },
      },
      select: { id: true },
    });
    if (lockedPayroll) {
      throw new ConflictException(
        'Bảng lương đã chốt hoặc đã thanh toán nên không thể mở lại bảng công',
      );
    }
    const reason = dto.reason.trim();
    await this.prisma.$transaction([
      this.prisma.staffAttendancePeriod.update({
        where: { id: current.id },
        data: {
          status: StaffAttendancePeriodStatus.RETURNED,
          reviewedAt: new Date(),
          reviewedById: adminUserId,
          reviewNote: reason,
        },
      }),
      this.prisma.staffAttendancePeriodEvent.create({
        data: {
          attendancePeriodId: current.id,
          action: StaffAttendancePeriodAction.REOPENED,
          fromStatus: StaffAttendancePeriodStatus.APPROVED,
          toStatus: StaffAttendancePeriodStatus.RETURNED,
          actorId: adminUserId,
          note: reason,
        },
      }),
      ...(current.submittedById
        ? [
            this.prisma.notification.create({
              data: {
                userId: current.submittedById,
                type: 'ATTENDANCE_PERIOD_REOPENED',
                title: 'Bảng công đã được mở lại',
                message: `Bảng công ${current.periodStart.toISOString().slice(0, 7)} của ${current.branch.code} đã được mở lại: ${reason}`,
              },
            }),
          ]
        : []),
    ]);
    const result = this.serializeAttendancePeriod(
      await this.loadAttendancePeriod(current.id),
    );
    await writeAuditLog(this.prisma, {
      actorId: adminUserId,
      branchId: current.branchId,
      module: 'ATTENDANCE',
      action: 'REOPEN_PERIOD',
      entityType: 'StaffAttendancePeriod',
      entityId: current.id,
      description: `Mở lại bảng công tháng ${result.month}`,
      beforeData: { status: current.status },
      afterData: { status: result.status, reason },
    });
    return result;
  }

  private buildReportRow(
    shift: {
      id: number;
      employeeId: number;
      branchId: number;
      startAt: Date;
      endAt: Date;
      employee: {
        id: number;
        email: string;
        fullName: string | null;
        avatarUrl: string | null;
        phone: string | null;
        isActive: boolean;
      };
    } | null,
    attendance: {
      id: number;
      employeeId: number;
      branchId: number;
      recordedById: number | null;
      scheduledShiftId: number | null;
      clockIn: Date;
      clockOut: Date | null;
      autoClockIn: boolean;
      autoClockOut: boolean;
      note: string | null;
      createdAt: Date;
      updatedAt: Date;
      employee: {
        id: number;
        email: string;
        fullName: string | null;
        avatarUrl: string | null;
        phone: string | null;
        isActive: boolean;
      };
      recordedBy: {
        id: number;
        fullName: string | null;
        email: string;
      } | null;
    } | null,
    leaveRequest: {
      id: number;
      type: string;
      scope: StaffLeaveScope;
      requestedStartAt: Date | null;
      requestedEndAt: Date | null;
      status: StaffLeaveStatus;
      reason: string;
      evidenceUrl: string | null;
      reviewNote: string | null;
    } | null,
    now: Date,
  ) {
    const employee = shift?.employee ?? attendance!.employee;
    const scheduledStart = shift?.startAt ?? null;
    const scheduledEnd = shift?.endAt ?? null;
    const workedSeconds = attendance
      ? Math.max(
          0,
          Math.floor(
            ((attendance.clockOut ?? now).getTime() -
              attendance.clockIn.getTime()) /
              1000,
          ),
        )
      : 0;
    // So sánh theo phút để vài giây thao tác ở đúng phút bắt đầu/kết thúc
    // không khiến nhân viên bị ghi nhận đi trễ hoặc về sớm oan.
    const approvedArrivalAt =
      leaveRequest?.status === StaffLeaveStatus.APPROVED &&
      leaveRequest.scope === StaffLeaveScope.LATE_ARRIVAL
        ? leaveRequest.requestedStartAt
        : null;
    const lateBaseline = approvedArrivalAt ?? scheduledStart;
    const isLate = Boolean(
      attendance &&
      lateBaseline &&
      attendance.clockIn.getTime() >= lateBaseline.getTime() + 60_000,
    );
    const isEarlyLeave = Boolean(
      attendance?.clockOut &&
      scheduledEnd &&
      attendance.clockOut.getTime() <= scheduledEnd.getTime() - 60_000,
    );
    const overtimeSeconds =
      attendance?.clockOut && scheduledEnd
        ? Math.max(
            0,
            Math.floor(
              (attendance.clockOut.getTime() - scheduledEnd.getTime()) / 1000,
            ),
          )
        : 0;

    let status = 'ON_TIME';
    if (!shift) status = attendance?.clockOut ? 'UNSCHEDULED' : 'IN_PROGRESS';
    else if (
      !attendance &&
      leaveRequest?.status === StaffLeaveStatus.APPROVED &&
      leaveRequest.scope === StaffLeaveScope.FULL_SHIFT
    )
      status = 'EXCUSED_LEAVE';
    else if (!attendance && leaveRequest?.status === StaffLeaveStatus.PENDING)
      status = 'LEAVE_PENDING';
    else if (
      !attendance &&
      leaveRequest?.status === StaffLeaveStatus.NEEDS_INFO
    )
      status = 'LEAVE_NEEDS_INFO';
    else if (!attendance) status = now > shift.endAt ? 'ABSENT' : 'UPCOMING';
    else if (!attendance.clockOut)
      status = isLate ? 'LATE_IN_PROGRESS' : 'IN_PROGRESS';
    else if (isLate && isEarlyLeave) status = 'LATE_AND_EARLY';
    else if (isLate) status = 'LATE';
    else if (isEarlyLeave) status = 'EARLY_LEAVE';

    return {
      key: shift ? `shift:${shift.id}` : `attendance:${attendance!.id}`,
      shiftId: shift?.id ?? null,
      attendanceId: attendance?.id ?? null,
      employee,
      scheduledStart,
      scheduledEnd,
      clockIn: attendance?.clockIn ?? null,
      clockOut: attendance?.clockOut ?? null,
      autoClockIn: attendance?.autoClockIn ?? false,
      autoClockOut: attendance?.autoClockOut ?? false,
      status,
      isLate,
      isEarlyLeave,
      workedSeconds,
      scheduledSeconds: shift
        ? Math.max(
            0,
            Math.floor(
              (shift.endAt.getTime() - shift.startAt.getTime()) / 1000,
            ),
          )
        : 0,
      overtimeSeconds,
      adjustmentReason: attendance?.note ?? null,
      updatedBy: attendance?.recordedBy ?? null,
      leaveRequest,
    };
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async getTemplatesForBranch(branchId: number) {
    const saved = await this.prisma.staffShiftTemplate.findMany({
      where: { branchId },
      orderBy: { startTime: 'asc' },
    });

    return DEFAULT_SHIFT_TEMPLATES.map((fallback) => {
      const template = saved.find((item) => item.period === fallback.period);
      return template ?? { id: null, branchId, ...fallback };
    });
  }

  private parseShiftRange(startValue: string, endValue: string) {
    const startAt = new Date(startValue);
    const endAt = new Date(endValue);

    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt <= startAt
    ) {
      throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu');
    }

    if (endAt.getTime() - startAt.getTime() > MAX_SHIFT_DURATION_MS) {
      throw new BadRequestException('Một ca làm không được dài quá 24 giờ');
    }

    return { startAt, endAt };
  }

  private async assertNoOverlap(
    employeeId: number,
    startAt: Date,
    endAt: Date,
    ignoredShiftId?: number,
  ) {
    const overlapping = await this.prisma.staffShift.findFirst({
      where: {
        employeeId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(ignoredShiftId ? { id: { not: ignoredShiftId } } : {}),
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new ConflictException('Nhân viên đã có ca làm trùng thời gian');
    }
  }

  async getWeek(
    viewerId: number,
    viewerRole: string,
    weekStart: string,
    branchId?: number,
  ) {
    const branch = await this.resolveViewBranch(viewerId, viewerRole, branchId);
    const range = this.getWeekRange(weekStart);
    const [employees, shifts, templates] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          staffProfile: { branchId: branch.id },
          role: { name: 'STAFF' },
        },
        select: {
          id: true,
          email: true,
          ...personProfileSelect,
          isActive: true,
        },
        orderBy: [
          { isActive: 'desc' },
          { profile: { fullName: 'asc' } },
          { email: 'asc' },
        ],
      }),
      this.prisma.staffShift.findMany({
        where: {
          branchId: branch.id,
          startAt: { gte: range.start, lt: range.end },
        },
        select: this.shiftSelect,
        orderBy: [{ startAt: 'asc' }, { employeeId: 'asc' }],
      }),
      this.getTemplatesForBranch(branch.id),
    ]);

    return {
      branch,
      weekStart,
      employees: employees.map((employee) => flattenPersonProfile(employee)),
      shifts: shifts.map((shift) => this.serializeShift(shift)),
      templates,
    };
  }

  async updateTemplates(
    dto: UpdateStaffShiftTemplatesDto,
    actorUserId?: number,
  ) {
    const branch = await this.prisma.storeBranch.findUnique({
      where: { id: dto.branchId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');

    const byPeriod = new Map(
      dto.templates.map((template) => [template.period, template]),
    );
    if (
      byPeriod.size !== DEFAULT_SHIFT_TEMPLATES.length ||
      DEFAULT_SHIFT_TEMPLATES.some(({ period }) => !byPeriod.has(period))
    ) {
      throw new BadRequestException(
        'Phải cấu hình đủ và không lặp ca sáng, chiều, tối',
      );
    }

    const ordered = DEFAULT_SHIFT_TEMPLATES.map(({ period }) =>
      byPeriod.get(period)!,
    );
    for (const template of ordered) {
      if (
        this.timeToMinutes(template.startTime) >=
        this.timeToMinutes(template.endTime)
      ) {
        throw new BadRequestException(
          'Giờ kết thúc của mỗi ca phải sau giờ bắt đầu',
        );
      }
    }
    if (
      this.timeToMinutes(ordered[0].endTime) >
        this.timeToMinutes(ordered[1].startTime) ||
      this.timeToMinutes(ordered[1].endTime) >
        this.timeToMinutes(ordered[2].startTime)
    ) {
      throw new BadRequestException('Các khung ca không được trùng thời gian');
    }

    const beforeData = actorUserId
      ? await this.getTemplatesForBranch(dto.branchId)
      : undefined;
    await this.prisma.$transaction(
      ordered.map((template) =>
        this.prisma.staffShiftTemplate.upsert({
          where: {
            branchId_period: {
              branchId: dto.branchId,
              period: template.period,
            },
          },
          create: { branchId: dto.branchId, ...template },
          update: {
            startTime: template.startTime,
            endTime: template.endTime,
          },
        }),
      ),
    );

    const result = await this.getTemplatesForBranch(dto.branchId);
    if (actorUserId) {
      await writeAuditLog(this.prisma, {
        actorId: actorUserId,
        branchId: dto.branchId,
        module: 'STAFF_SCHEDULE',
        action: 'UPDATE_SHIFT_TEMPLATES',
        entityType: 'StaffShiftTemplate',
        entityId: dto.branchId,
        description: 'Cập nhật giờ hoạt động của các khung ca',
        beforeData,
        afterData: result,
      });
    }
    return result;
  }

  async create(managerUserId: number, dto: CreateStaffShiftDto) {
    const branch = await this.getManagedBranch(managerUserId);
    const employee = await this.prisma.user.findFirst({
      where: {
        id: dto.employeeId,
        staffProfile: { branchId: branch.id },
        isActive: true,
        role: { name: 'STAFF' },
      },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException(
        'Không tìm thấy nhân viên đang hoạt động trong chi nhánh',
      );
    }

    const { startAt, endAt } = this.parseShiftRange(dto.startAt, dto.endAt);
    await this.assertAttendancePeriodEditable(branch.id, startAt);
    await this.assertNoOverlap(employee.id, startAt, endAt);

    const created = await this.prisma.staffShift.create({
      data: {
        employeeId: employee.id,
        branchId: branch.id,
        startAt,
        endAt,
        note: dto.note?.trim() || null,
        createdById: managerUserId,
      },
      select: this.shiftSelect,
    });
    await this.linkOverlappingUnscheduledAttendance(
      created.id,
      employee.id,
      branch.id,
      startAt,
      endAt,
    );
    const result = this.serializeShift(created);
    await writeAuditLog(this.prisma, {
      actorId: managerUserId,
      branchId: branch.id,
      module: 'STAFF_SCHEDULE',
      action: 'CREATE_SHIFT',
      entityType: 'StaffShift',
      entityId: created.id,
      description: `Xếp ca #${created.id} cho nhân viên #${employee.id}`,
      afterData: result,
    });
    return result;
  }

  async update(managerUserId: number, id: number, dto: UpdateStaffShiftDto) {
    const branch = await this.getManagedBranch(managerUserId);
    const current = await this.prisma.staffShift.findFirst({
      where: { id, branchId: branch.id },
    });
    if (!current) throw new NotFoundException('Không tìm thấy ca làm');

    const { startAt, endAt } = this.parseShiftRange(
      dto.startAt ?? current.startAt.toISOString(),
      dto.endAt ?? current.endAt.toISOString(),
    );
    await this.assertAttendancePeriodEditable(branch.id, current.startAt);
    if (
      this.attendancePeriodStartFor(current.startAt).getTime() !==
      this.attendancePeriodStartFor(startAt).getTime()
    ) {
      await this.assertAttendancePeriodEditable(branch.id, startAt);
    }
    await this.assertNoOverlap(current.employeeId, startAt, endAt, id);

    const updated = await this.prisma.staffShift.update({
      where: { id },
      data: {
        startAt,
        endAt,
        ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
      },
      select: this.shiftSelect,
    });
    const result = this.serializeShift(updated);
    await writeAuditLog(this.prisma, {
      actorId: managerUserId,
      branchId: branch.id,
      module: 'STAFF_SCHEDULE',
      action: 'UPDATE_SHIFT',
      entityType: 'StaffShift',
      entityId: id,
      description: `Điều chỉnh ca #${id}`,
      beforeData: current,
      afterData: result,
    });
    return result;
  }

  async remove(managerUserId: number, id: number) {
    const branch = await this.getManagedBranch(managerUserId);
    const current = await this.prisma.staffShift.findFirst({
      where: { id, branchId: branch.id },
      select: {
        ...this.shiftSelect,
        _count: { select: { leaveRequests: true, attendances: true } },
      },
    });
    if (!current) throw new NotFoundException('Không tìm thấy ca làm');
    await this.assertAttendancePeriodEditable(branch.id, current.startAt);
    if (current._count.leaveRequests > 0) {
      throw new BadRequestException(
        'Ca đã có yêu cầu nghỉ; không thể xóa để giữ lịch sử xét duyệt',
      );
    }
    if (current._count.attendances > 0) {
      throw new BadRequestException(
        'Ca đã có chấm công; không thể xóa để giữ lịch sử bảng công',
      );
    }

    await this.prisma.staffShift.delete({ where: { id } });
    const currentSnapshot = this.serializeShift(current);
    const employeeName =
      currentSnapshot.employee.fullName || currentSnapshot.employee.email;
    await writeAuditLog(this.prisma, {
      actorId: managerUserId,
      branchId: branch.id,
      module: 'STAFF_SCHEDULE',
      action: 'DELETE_SHIFT',
      entityType: 'StaffShift',
      entityId: id,
      description: `Xóa ca làm của ${employeeName}`,
      beforeData: {
        employee: currentSnapshot.employee,
        startAt: currentSnapshot.startAt,
        endAt: currentSnapshot.endAt,
        note: currentSnapshot.note,
      },
      afterData: { deleted: true },
    });
    return { deleted: true, id };
  }

  async getAttendanceReport(
    viewerId: number,
    viewerRole: string,
    startDate: string,
    endDate: string,
    branchId?: number,
  ) {
    const branch = await this.resolveViewBranch(viewerId, viewerRole, branchId);
    const range = this.getReportRange(startDate, endDate);
    const now = new Date();
    const personalEmployeeId =
      viewerRole === 'STAFF_SELF' ? viewerId : undefined;
    if (personalEmployeeId) {
      await synchronizeEmployeeAttendance(
        this.prisma,
        personalEmployeeId,
        branch.id,
        now,
      );
    } else {
      await synchronizeBranchAttendances(this.prisma, branch.id, now);
    }
    const [rawShifts, rawUnscheduledAttendances] = await Promise.all([
      this.prisma.staffShift.findMany({
        where: {
          branchId: branch.id,
          ...(personalEmployeeId
            ? { employeeId: personalEmployeeId }
            : {}),
          startAt: { gte: range.start, lt: range.end },
        },
        select: {
          id: true,
          employeeId: true,
          branchId: true,
          startAt: true,
          endAt: true,
          employee: {
            select: {
              id: true,
              email: true,
              ...personProfileSelect,
              isActive: true,
            },
          },
          attendances: {
            select: this.reportAttendanceSelect,
            orderBy: { clockIn: 'asc' },
            take: 1,
          },
          leaveRequests: {
            where: {
              status: {
                in: [
                  StaffLeaveStatus.PENDING,
                  StaffLeaveStatus.NEEDS_INFO,
                  StaffLeaveStatus.APPROVED,
                ],
              },
            },
            select: {
              id: true,
              type: true,
              scope: true,
              requestedStartAt: true,
              requestedEndAt: true,
              status: true,
              reason: true,
              evidenceUrl: true,
              reviewNote: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ startAt: 'desc' }, { employeeId: 'asc' }],
      }),
      this.prisma.staffAttendance.findMany({
        where: {
          branchId: branch.id,
          ...(personalEmployeeId
            ? { employeeId: personalEmployeeId }
            : {}),
          scheduledShiftId: null,
          clockIn: { gte: range.start, lt: range.end },
        },
        select: this.reportAttendanceSelect,
        orderBy: { clockIn: 'desc' },
      }),
    ]);

    const shifts = rawShifts.map(({ employee, attendances, ...shift }) => ({
      ...shift,
      employee: flattenPersonProfile(employee),
      attendances: attendances.map((attendance) =>
        this.serializeAttendance(attendance),
      ),
    }));
    const unscheduledAttendances = rawUnscheduledAttendances.map((attendance) =>
      this.serializeAttendance(attendance),
    );

    // Dữ liệu cũ hoặc ca được xếp bổ sung sau khi nhân viên đã chấm công có thể
    // chưa mang scheduledShiftId. Ghép theo nhân viên và khoảng giờ giao nhau để
    // báo cáo không tách thành một dòng "Vắng mặt" và một dòng "Ngoài lịch".
    const remainingUnscheduled = new Map(
      unscheduledAttendances.map((attendance) => [attendance.id, attendance]),
    );
    const recoveredAttendanceByShift = new Map<
      number,
      (typeof unscheduledAttendances)[number]
    >();
    for (const shift of shifts) {
      if (shift.attendances.length > 0) continue;
      const matching = [...remainingUnscheduled.values()].find(
        (attendance) =>
          attendance.employeeId === shift.employeeId &&
          attendance.clockIn < shift.endAt &&
          (attendance.clockOut ?? now) > shift.startAt,
      );
      if (matching) {
        recoveredAttendanceByShift.set(shift.id, matching);
        remainingUnscheduled.delete(matching.id);
      }
    }

    const rows = [
      ...shifts.map((shift) =>
        this.buildReportRow(
          shift,
          shift.attendances[0] ??
            recoveredAttendanceByShift.get(shift.id) ??
            null,
          shift.leaveRequests[0] ?? null,
          now,
        ),
      ),
      ...[...remainingUnscheduled.values()].map((attendance) =>
        this.buildReportRow(null, attendance, null, now),
      ),
    ].sort((left, right) => {
      const leftTime = new Date(
        left.scheduledStart ?? left.clockIn ?? 0,
      ).getTime();
      const rightTime = new Date(
        right.scheduledStart ?? right.clockIn ?? 0,
      ).getTime();
      return rightTime - leftTime;
    });

    const employees = new Map<
      number,
      {
        employee: (typeof rows)[number]['employee'];
        scheduledShifts: number;
        attendedShifts: number;
        completedShifts: number;
        lateShifts: number;
        earlyLeaveShifts: number;
        absentShifts: number;
        excusedLeaveShifts: number;
        workedSeconds: number;
        overtimeSeconds: number;
      }
    >();

    for (const row of rows) {
      const current = employees.get(row.employee.id) ?? {
        employee: row.employee,
        scheduledShifts: 0,
        attendedShifts: 0,
        completedShifts: 0,
        lateShifts: 0,
        earlyLeaveShifts: 0,
        absentShifts: 0,
        excusedLeaveShifts: 0,
        workedSeconds: 0,
        overtimeSeconds: 0,
      };
      if (row.shiftId) current.scheduledShifts += 1;
      if (row.attendanceId) current.attendedShifts += 1;
      if (row.clockOut) {
        current.completedShifts += 1;
        current.workedSeconds += row.workedSeconds;
        current.overtimeSeconds += row.overtimeSeconds;
      }
      if (row.isLate) current.lateShifts += 1;
      if (row.isEarlyLeave) current.earlyLeaveShifts += 1;
      if (row.status === 'ABSENT') current.absentShifts += 1;
      if (row.status === 'EXCUSED_LEAVE') current.excusedLeaveShifts += 1;
      employees.set(row.employee.id, current);
    }

    return {
      branch,
      startDate,
      endDate,
      generatedAt: now,
      timeZone: 'Asia/Ho_Chi_Minh',
      summary: {
        scheduledShifts: shifts.length,
        completedShifts: rows.filter((row) => Boolean(row.clockOut)).length,
        onTimeShifts: rows.filter((row) => row.status === 'ON_TIME').length,
        lateShifts: rows.filter((row) => row.isLate).length,
        earlyLeaveShifts: rows.filter((row) => row.isEarlyLeave).length,
        absentShifts: rows.filter((row) => row.status === 'ABSENT').length,
        excusedLeaveShifts: rows.filter((row) => row.status === 'EXCUSED_LEAVE')
          .length,
        pendingLeaveShifts: rows.filter(
          (row) =>
            row.status === 'LEAVE_PENDING' || row.status === 'LEAVE_NEEDS_INFO',
        ).length,
        workedSeconds: rows.reduce(
          (total, row) => total + (row.clockOut ? row.workedSeconds : 0),
          0,
        ),
        overtimeSeconds: rows.reduce(
          (total, row) => total + (row.clockOut ? row.overtimeSeconds : 0),
          0,
        ),
      },
      employees: [...employees.values()].sort((left, right) =>
        (left.employee.fullName || left.employee.email).localeCompare(
          right.employee.fullName || right.employee.email,
          'vi',
        ),
      ),
      rows,
    };
  }

  async getMyAttendanceReport(staffUserId: number, month: string) {
    const range = getPayrollMonthRange(month);
    const startDate = range.periodStart.toISOString().slice(0, 10);
    const endDate = new Date(range.periodEnd.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return this.getAttendanceReport(
      staffUserId,
      'STAFF_SELF',
      startDate,
      endDate,
    );
  }

  async updateAttendance(
    managerUserId: number,
    attendanceId: number,
    dto: UpdateStaffAttendanceDto,
  ) {
    const branch = await this.getManagedBranch(managerUserId);
    const current = await this.prisma.staffAttendance.findFirst({
      where: { id: attendanceId, branchId: branch.id },
      select: {
        id: true,
        employeeId: true,
        scheduledShiftId: true,
        clockIn: true,
        clockOut: true,
      },
    });
    if (!current) {
      throw new NotFoundException(
        'Không tìm thấy lần chấm công trong chi nhánh',
      );
    }
    if (!current.clockOut) {
      throw new BadRequestException(
        'Cần kết thúc ca trước khi điều chỉnh giờ chấm công',
      );
    }

    const clockIn = new Date(dto.clockIn);
    const clockOut = new Date(dto.clockOut);
    if (
      Number.isNaN(clockIn.getTime()) ||
      Number.isNaN(clockOut.getTime()) ||
      clockOut <= clockIn
    ) {
      throw new BadRequestException('Giờ ra ca phải sau giờ vào ca');
    }
    if (clockOut.getTime() - clockIn.getTime() > MAX_SHIFT_DURATION_MS) {
      throw new BadRequestException('Thời gian làm không được vượt quá 24 giờ');
    }
    if (clockOut.getTime() > Date.now() + 60_000) {
      throw new BadRequestException(
        'Không thể ghi nhận giờ ra ca trong tương lai',
      );
    }

    const previousClockIn = current.clockIn ?? clockIn;
    await this.assertAttendancePeriodEditable(branch.id, previousClockIn);
    if (
      this.attendancePeriodStartFor(previousClockIn).getTime() !==
      this.attendancePeriodStartFor(clockIn).getTime()
    ) {
      await this.assertAttendancePeriodEditable(branch.id, clockIn);
    }

    let scheduledShiftId = current.scheduledShiftId;
    if (!scheduledShiftId) {
      const matchingShift = await this.prisma.staffShift.findFirst({
        where: {
          employeeId: current.employeeId,
          branchId: branch.id,
          startAt: { lt: clockOut },
          endAt: { gt: clockIn },
          attendances: { none: {} },
        },
        select: { id: true },
        orderBy: { startAt: 'asc' },
      });
      scheduledShiftId = matchingShift?.id ?? null;
    }

    const attendance = await this.prisma.staffAttendance.update({
      where: { id: current.id },
      data: {
        clockIn,
        clockOut,
        note: dto.reason.trim(),
        recordedById: managerUserId,
        scheduledShiftId,
      },
      select: this.reportAttendanceSelect,
    });
    const result = this.serializeAttendance(attendance);
    await writeAuditLog(this.prisma, {
      actorId: managerUserId,
      branchId: branch.id,
      module: 'ATTENDANCE',
      action: 'UPDATE_ATTENDANCE',
      entityType: 'StaffAttendance',
      entityId: attendanceId,
      description: `Điều chỉnh chấm công #${attendanceId} của nhân viên #${current.employeeId}`,
      beforeData: current,
      afterData: {
        clockIn: result.clockIn,
        clockOut: result.clockOut,
        scheduledShiftId: result.scheduledShiftId,
        reason: dto.reason.trim(),
      },
    });
    return result;
  }

  private async linkOverlappingUnscheduledAttendance(
    shiftId: number,
    employeeId: number,
    branchId: number,
    startAt: Date,
    endAt: Date,
  ) {
    const attendance = await this.prisma.staffAttendance.findFirst({
      where: {
        employeeId,
        branchId,
        scheduledShiftId: null,
        clockIn: { lt: endAt },
        OR: [{ clockOut: null }, { clockOut: { gt: startAt } }],
      },
      select: { id: true },
      orderBy: { clockIn: 'asc' },
    });
    if (!attendance) return;
    await this.prisma.staffAttendance.update({
      where: { id: attendance.id },
      data: { scheduledShiftId: shiftId },
    });
  }

  async getMyStatus(staffUserId: number) {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      select: {
        id: true,
        staffProfile: { select: { branchId: true } },
        isActive: true,
        role: { select: { name: true } },
      },
    });
    if (!staff || staff.role.name !== 'STAFF' || !staff.isActive) {
      throw new ForbiddenException('Chức năng này chỉ dành cho nhân viên');
    }
    if (!staff.staffProfile?.branchId) {
      throw new BadRequestException('Nhân viên chưa được phân công chi nhánh');
    }

    const now = new Date();
    await synchronizeEmployeeAttendance(
      this.prisma,
      staff.id,
      staff.staffProfile.branchId,
      now,
    );
    const earlyLimit = new Date(
      now.getTime() + CHECK_IN_EARLY_MINUTES * 60 * 1000,
    );
    const [openAttendance, eligibleShift] = await Promise.all([
      this.prisma.staffAttendance.findUnique({
        where: { openKey: `employee:${staff.id}` },
        select: { id: true, scheduledShiftId: true },
      }),
      this.prisma.staffShift.findFirst({
        where: {
          employeeId: staff.id,
          branchId: staff.staffProfile.branchId,
          startAt: { lte: earlyLimit },
          endAt: { gt: now },
          attendances: { none: {} },
          leaveRequests: {
            none: {
              status: StaffLeaveStatus.APPROVED,
              scope: StaffLeaveScope.FULL_SHIFT,
            },
          },
        },
        select: this.shiftSelect,
        orderBy: { startAt: 'desc' },
      }),
    ]);
    const nextShift = eligibleShift
      ? null
      : await this.prisma.staffShift.findFirst({
          where: {
            employeeId: staff.id,
            branchId: staff.staffProfile.branchId,
            startAt: { gt: earlyLimit },
            attendances: { none: {} },
            leaveRequests: {
              none: {
                status: StaffLeaveStatus.APPROVED,
                scope: StaffLeaveScope.FULL_SHIFT,
              },
            },
          },
          select: this.shiftSelect,
          orderBy: { startAt: 'asc' },
        });

    return {
      serverTime: now,
      checkInEarlyMinutes: CHECK_IN_EARLY_MINUTES,
      hasOpenAttendance: Boolean(openAttendance),
      canCheckIn: !openAttendance && Boolean(eligibleShift),
      eligibleShift: eligibleShift ? this.serializeShift(eligibleShift) : null,
      nextShift: nextShift ? this.serializeShift(nextShift) : null,
      checkInOpensAt: eligibleShift
        ? new Date(
            eligibleShift.startAt.getTime() -
              CHECK_IN_EARLY_MINUTES * 60 * 1000,
          )
        : nextShift
          ? new Date(
              nextShift.startAt.getTime() - CHECK_IN_EARLY_MINUTES * 60 * 1000,
            )
          : null,
    };
  }
}
