import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  StaffLeaveScope,
  StaffLeaveStatus,
  StaffLeaveType,
  StaffShiftCoverageStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffLeaveDto } from './dto/create-staff-leave.dto';
import { AssignShiftCoverageDto } from './dto/assign-shift-coverage.dto';
import { ReviewStaffLeaveDto } from './dto/review-staff-leave.dto';
import { RespondShiftCoverageDto } from './dto/respond-shift-coverage.dto';
import { SupplementStaffLeaveDto } from './dto/supplement-staff-leave.dto';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';

const PLANNED_NOTICE_MS = 48 * 60 * 60 * 1000;
const EMERGENCY_FOLLOW_UP_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StaffLeavesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly requestSelect = {
    id: true,
    employeeId: true,
    branchId: true,
    staffShiftId: true,
    type: true,
    scope: true,
    requestedStartAt: true,
    requestedEndAt: true,
    status: true,
    reason: true,
    evidenceUrl: true,
    reviewNote: true,
    reviewedById: true,
    reviewedAt: true,
    createdAt: true,
    updatedAt: true,
    employee: {
      select: {
        id: true,
        email: true,
        ...personProfileSelect,
      },
    },
    branch: { select: { id: true, code: true, name: true } },
    staffShift: {
      select: { id: true, startAt: true, endAt: true, note: true },
    },
    reviewedBy: {
      select: { id: true, email: true, ...personProfileSelect },
    },
    coverages: {
      select: {
        id: true,
        leaveRequestId: true,
        branchId: true,
        coveringEmployeeId: true,
        assignedById: true,
        startAt: true,
        endAt: true,
        actualEndAt: true,
        status: true,
        respondedAt: true,
        createdAt: true,
        updatedAt: true,
        coveringEmployee: {
          select: { id: true, email: true, ...personProfileSelect },
        },
        assignedBy: {
          select: { id: true, email: true, ...personProfileSelect },
        },
      },
      orderBy: { createdAt: 'desc' as const },
      take: 1,
    },
  } as const;

  private serializeRequest<
    T extends {
      employee: Parameters<typeof flattenPersonProfile>[0];
      reviewedBy: Parameters<typeof flattenPersonProfile>[0] | null;
      coverages?: Array<{
        coveringEmployee: Parameters<typeof flattenPersonProfile>[0];
        assignedBy: Parameters<typeof flattenPersonProfile>[0];
      }>;
    },
  >(request: T) {
    const { coverages, ...requestData } = request;
    const coverage = coverages?.[0] ?? null;
    return {
      ...requestData,
      employee: flattenPersonProfile(request.employee),
      reviewedBy: request.reviewedBy
        ? flattenPersonProfile(request.reviewedBy)
        : null,
      coverage: coverage
        ? {
            ...coverage,
            coveringEmployee: flattenPersonProfile(coverage.coveringEmployee),
            assignedBy: flattenPersonProfile(coverage.assignedBy),
          }
        : null,
    };
  }

  private async getStaff(userId: number) {
    const staff = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        profile: { select: { fullName: true } },
        isActive: true,
        role: { select: { name: true } },
        staffProfile: {
          select: {
            branchId: true,
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                managerId: true,
              },
            },
          },
        },
      },
    });

    if (!staff || staff.role.name !== 'STAFF' || !staff.isActive) {
      throw new ForbiddenException('Chức năng này chỉ dành cho nhân viên');
    }
    const branch = staff.staffProfile?.branch;
    if (!staff.staffProfile?.branchId || !branch || !branch.isActive) {
      throw new BadRequestException('Nhân viên chưa thuộc chi nhánh hoạt động');
    }
    return {
      ...staff,
      fullName: staff.profile?.fullName ?? null,
      branch,
    };
  }

  private async getManager(userId: number) {
    const manager = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        staffProfile: { select: { branchId: true } },
        role: { select: { name: true } },
        managedBranch: {
          select: { id: true, code: true, name: true, isActive: true },
        },
      },
    });
    const managedBranch = manager?.managedBranch;
    if (
      !manager ||
      !manager.isActive ||
      manager.role.name !== 'BRANCH_MANAGER' ||
      !managedBranch ||
      manager.staffProfile?.branchId !== managedBranch.id
    ) {
      throw new ForbiddenException(
        'Tài khoản chưa được giao quản lý chi nhánh',
      );
    }
    if (!managedBranch.isActive) {
      throw new ForbiddenException('Chi nhánh đang bị khóa');
    }
    return { ...manager, managedBranch };
  }

  private formatShift(startAt: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    }).format(startAt);
  }

  async getMine(userId: number) {
    const staff = await this.getStaff(userId);
    const now = new Date();
    const from = new Date(now.getTime() - EMERGENCY_FOLLOW_UP_MS);
    const to = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const [shifts, coverageAssignments] = await Promise.all([
      this.prisma.staffShift.findMany({
        where: {
          employeeId: staff.id,
          branchId: staff.branch.id,
          endAt: { gte: from },
          startAt: { lte: to },
        },
        select: {
          id: true,
          employeeId: true,
          branchId: true,
          startAt: true,
          endAt: true,
          note: true,
          attendances: { select: { id: true }, take: 1 },
          leaveRequests: {
            select: this.requestSelect,
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.staffShiftCoverage.findMany({
        where: {
          coveringEmployeeId: staff.id,
          branchId: staff.branch.id,
          endAt: { gte: from },
          startAt: { lte: to },
        },
        select: {
          id: true,
          leaveRequestId: true,
          startAt: true,
          endAt: true,
          actualEndAt: true,
          status: true,
          respondedAt: true,
          leaveRequest: {
            select: {
              employee: {
                select: { id: true, email: true, ...personProfileSelect },
              },
              staffShift: {
                select: { id: true, startAt: true, endAt: true },
              },
              reason: true,
            },
          },
          assignedBy: {
            select: { id: true, email: true, ...personProfileSelect },
          },
        },
        orderBy: { startAt: 'asc' },
      }),
    ]);

    return {
      serverTime: now,
      rules: {
        plannedNoticeHours: PLANNED_NOTICE_MS / (60 * 60 * 1000),
        emergencyFollowUpHours: EMERGENCY_FOLLOW_UP_MS / (60 * 60 * 1000),
      },
      branch: {
        id: staff.branch.id,
        code: staff.branch.code,
        name: staff.branch.name,
      },
      shifts: shifts.map(({ leaveRequests, attendances, ...shift }) => ({
        ...shift,
        hasAttendance: attendances.length > 0,
        leaveRequest: leaveRequests[0]
          ? this.serializeRequest(leaveRequests[0])
          : null,
      })),
      coverageAssignments: coverageAssignments.map((coverage) => ({
        ...coverage,
        leaveRequest: {
          ...coverage.leaveRequest,
          employee: flattenPersonProfile(coverage.leaveRequest.employee),
        },
        assignedBy: flattenPersonProfile(coverage.assignedBy),
      })),
    };
  }

  async create(userId: number, dto: CreateStaffLeaveDto) {
    const staff = await this.getStaff(userId);
    const shift = await this.prisma.staffShift.findFirst({
      where: {
        id: dto.staffShiftId,
        employeeId: staff.id,
        branchId: staff.branch.id,
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        _count: { select: { attendances: true } },
      },
    });
    if (!shift)
      throw new NotFoundException('Không tìm thấy ca làm cần xin nghỉ');
    const scope = dto.scope ?? StaffLeaveScope.FULL_SHIFT;
    const requestedStartAt =
      scope === StaffLeaveScope.LATE_ARRIVAL && dto.requestedStartAt
        ? new Date(dto.requestedStartAt)
        : null;
    const requestedEndAt =
      scope === StaffLeaveScope.EARLY_LEAVE && dto.requestedEndAt
        ? new Date(dto.requestedEndAt)
        : null;
    if (
      (scope === StaffLeaveScope.FULL_SHIFT ||
        scope === StaffLeaveScope.LATE_ARRIVAL) &&
      shift._count.attendances > 0
    ) {
      throw new BadRequestException(
        'Ca đã chấm công nên không thể gửi yêu cầu nghỉ hoặc đến trễ',
      );
    }
    if (
      scope === StaffLeaveScope.LATE_ARRIVAL &&
      (!requestedStartAt ||
        Number.isNaN(requestedStartAt.getTime()) ||
        requestedStartAt <= shift.startAt ||
        requestedStartAt >= shift.endAt)
    ) {
      throw new BadRequestException(
        'Giờ dự kiến đến phải nằm trong khoảng thời gian của ca',
      );
    }
    if (
      scope === StaffLeaveScope.EARLY_LEAVE &&
      (!requestedEndAt ||
        Number.isNaN(requestedEndAt.getTime()) ||
        requestedEndAt <= shift.startAt ||
        requestedEndAt >= shift.endAt)
    ) {
      throw new BadRequestException(
        'Giờ xin về sớm phải nằm trong khoảng thời gian của ca',
      );
    }

    const existing = await this.prisma.staffLeaveRequest.findUnique({
      where: {
        employeeId_staffShiftId: {
          employeeId: staff.id,
          staffShiftId: shift.id,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Ca này đã có yêu cầu nghỉ');
    }

    const now = new Date();
    const noticeMs = shift.startAt.getTime() - now.getTime();
    if (dto.type === StaffLeaveType.PLANNED && noticeMs < PLANNED_NOTICE_MS) {
      throw new BadRequestException(
        'Nghỉ có kế hoạch phải được gửi trước giờ vào ca ít nhất 48 giờ',
      );
    }
    if (
      dto.type === StaffLeaveType.EMERGENCY &&
      noticeMs >= PLANNED_NOTICE_MS
    ) {
      throw new BadRequestException(
        'Ca còn trên 48 giờ; vui lòng chọn nghỉ báo trước',
      );
    }
    if (
      dto.type === StaffLeaveType.EMERGENCY &&
      now.getTime() > shift.endAt.getTime() + EMERGENCY_FOLLOW_UP_MS
    ) {
      throw new BadRequestException(
        'Đã quá 24 giờ sau ca, không thể gửi yêu cầu nghỉ đột xuất',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.staffLeaveRequest.create({
        data: {
          employeeId: staff.id,
          branchId: staff.branch.id,
          staffShiftId: shift.id,
          type: dto.type,
          scope,
          requestedStartAt,
          requestedEndAt,
          reason: dto.reason.trim(),
          evidenceUrl: dto.evidenceUrl?.trim() || null,
        },
        select: this.requestSelect,
      });
      if (staff.branch.managerId) {
        const requestLabel =
          scope === StaffLeaveScope.LATE_ARRIVAL
            ? `xin đến trễ lúc ${this.formatShift(requestedStartAt!)}`
            : scope === StaffLeaveScope.EARLY_LEAVE
              ? `xin về sớm lúc ${this.formatShift(requestedEndAt!)}`
              : `xin ${
                  dto.type === StaffLeaveType.EMERGENCY
                    ? 'nghỉ đột xuất'
                    : 'nghỉ báo trước'
                }`;
        await tx.notification.create({
          data: {
            userId: staff.branch.managerId,
            type: 'LEAVE_REQUEST_CREATED',
            title: 'Yêu cầu nghỉ / đi trễ / về sớm mới',
            message: `${staff.fullName || staff.email} ${requestLabel} cho ca ${this.formatShift(shift.startAt)}.`,
          },
        });
      }
      return this.serializeRequest(created);
    });
  }

  async supplement(
    userId: number,
    requestId: number,
    dto: SupplementStaffLeaveDto,
  ) {
    const staff = await this.getStaff(userId);
    const request = await this.prisma.staffLeaveRequest.findFirst({
      where: { id: requestId, employeeId: staff.id },
      select: {
        id: true,
        status: true,
        evidenceUrl: true,
        staffShift: { select: { startAt: true, endAt: true } },
      },
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu nghỉ');
    if (request.status !== StaffLeaveStatus.NEEDS_INFO) {
      throw new BadRequestException('Yêu cầu này không chờ bổ sung thông tin');
    }
    if (
      Date.now() >
      request.staffShift.endAt.getTime() + EMERGENCY_FOLLOW_UP_MS
    ) {
      throw new BadRequestException('Đã quá hạn 24 giờ để bổ sung yêu cầu');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.staffLeaveRequest.update({
        where: { id: request.id },
        data: {
          reason: dto.reason.trim(),
          evidenceUrl: dto.evidenceUrl?.trim() || request.evidenceUrl,
          status: StaffLeaveStatus.PENDING,
        },
        select: this.requestSelect,
      });
      if (staff.branch.managerId) {
        await tx.notification.create({
          data: {
            userId: staff.branch.managerId,
            type: 'LEAVE_REQUEST_SUPPLEMENTED',
            title: 'Yêu cầu nghỉ đã được bổ sung',
            message: `${staff.fullName || staff.email} đã bổ sung yêu cầu nghỉ ca ${this.formatShift(request.staffShift.startAt)}.`,
          },
        });
      }
      return this.serializeRequest(updated);
    });
  }

  async cancel(userId: number, requestId: number) {
    const staff = await this.getStaff(userId);
    const request = await this.prisma.staffLeaveRequest.findFirst({
      where: { id: requestId, employeeId: staff.id },
      select: {
        id: true,
        status: true,
        staffShift: { select: { startAt: true, endAt: true } },
      },
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu nghỉ');
    if (
      request.status !== StaffLeaveStatus.PENDING &&
      request.status !== StaffLeaveStatus.NEEDS_INFO
    ) {
      throw new BadRequestException('Yêu cầu đã được xử lý nên không thể hủy');
    }
    if (Date.now() >= request.staffShift.endAt.getTime()) {
      throw new BadRequestException('Ca đã kết thúc nên không thể hủy yêu cầu');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.staffLeaveRequest.update({
        where: { id: request.id },
        data: { status: StaffLeaveStatus.CANCELLED },
        select: this.requestSelect,
      });
      if (staff.branch.managerId) {
        await tx.notification.create({
          data: {
            userId: staff.branch.managerId,
            type: 'LEAVE_REQUEST_CANCELLED',
            title: 'Yêu cầu nghỉ đã hủy',
            message: `${staff.fullName || staff.email} đã hủy yêu cầu nghỉ ca ${this.formatShift(request.staffShift.startAt)}.`,
          },
        });
      }
      return this.serializeRequest(updated);
    });
  }

  async getBranchRequests(userId: number, status?: StaffLeaveStatus) {
    const manager = await this.getManager(userId);
    const items = await this.prisma.staffLeaveRequest.findMany({
      where: {
        branchId: manager.managedBranch.id,
        ...(status ? { status } : {}),
      },
      select: this.requestSelect,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 150,
    });
    return {
      branch: manager.managedBranch,
      pendingCount: await this.prisma.staffLeaveRequest.count({
        where: {
          branchId: manager.managedBranch.id,
          status: StaffLeaveStatus.PENDING,
        },
      }),
      items: items.map((item) => this.serializeRequest(item)),
    };
  }

  async getCoverageCandidates(userId: number, requestId: number) {
    const manager = await this.getManager(userId);
    const request = await this.prisma.staffLeaveRequest.findFirst({
      where: { id: requestId, branchId: manager.managedBranch.id },
      select: {
        employeeId: true,
        scope: true,
        requestedStartAt: true,
        staffShift: { select: { startAt: true } },
      },
    });
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu trong chi nhánh');
    }
    if (
      request.scope !== StaffLeaveScope.LATE_ARRIVAL ||
      !request.requestedStartAt
    ) {
      throw new BadRequestException(
        'Chỉ đơn xin đến trễ mới có thể phân công người làm thay',
      );
    }

    const previousShifts = await this.prisma.staffShift.findMany({
      where: {
        branchId: manager.managedBranch.id,
        endAt: request.staffShift.startAt,
        employeeId: { not: request.employeeId },
        employee: {
          isActive: true,
          role: { name: 'STAFF' },
          scheduledShifts: {
            none: {
              branchId: manager.managedBranch.id,
              startAt: { lt: request.requestedStartAt },
              endAt: { gt: request.staffShift.startAt },
            },
          },
        },
      },
      select: {
        employee: {
          select: { id: true, email: true, ...personProfileSelect },
        },
        startAt: true,
        endAt: true,
      },
      orderBy: { employeeId: 'asc' },
    });

    return previousShifts.map((shift) => ({
      employee: flattenPersonProfile(shift.employee),
      previousShiftStartAt: shift.startAt,
      previousShiftEndAt: shift.endAt,
    }));
  }

  async assignCoverage(
    userId: number,
    requestId: number,
    dto: AssignShiftCoverageDto,
  ) {
    const manager = await this.getManager(userId);
    const request = await this.prisma.staffLeaveRequest.findFirst({
      where: { id: requestId, branchId: manager.managedBranch.id },
      select: {
        id: true,
        employeeId: true,
        status: true,
        scope: true,
        requestedStartAt: true,
        staffShift: { select: { startAt: true, endAt: true } },
        coverages: {
          select: {
            id: true,
            coveringEmployeeId: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu trong chi nhánh');
    }
    if (
      request.status !== StaffLeaveStatus.APPROVED ||
      request.scope !== StaffLeaveScope.LATE_ARRIVAL ||
      !request.requestedStartAt
    ) {
      throw new BadRequestException(
        'Chỉ có thể phân công lại cho đơn xin đến trễ đã được duyệt',
      );
    }
    if (Date.now() >= request.staffShift.startAt.getTime()) {
      throw new BadRequestException(
        'Ca đã bắt đầu; hãy điều chỉnh chấm công thủ công nếu có người hỗ trợ',
      );
    }
    const requestedStartAt = request.requestedStartAt;
    const latestCoverage = request.coverages[0] ?? null;
    if (
      latestCoverage &&
      (latestCoverage.status === StaffShiftCoverageStatus.ACCEPTED ||
        latestCoverage.status === StaffShiftCoverageStatus.COMPLETED)
    ) {
      throw new BadRequestException(
        'Phân công hiện tại đã được nhận nên không thể thay người',
      );
    }

    const candidate = await this.prisma.staffShift.findFirst({
      where: {
        branchId: manager.managedBranch.id,
        employeeId: {
          equals: dto.coveringEmployeeId,
          not: request.employeeId,
        },
        endAt: request.staffShift.startAt,
        employee: {
          isActive: true,
          role: { name: 'STAFF' },
          scheduledShifts: {
            none: {
              branchId: manager.managedBranch.id,
              startAt: { lt: request.requestedStartAt },
              endAt: { gt: request.staffShift.startAt },
            },
          },
        },
      },
      select: {
        id: true,
        employee: {
          select: { id: true, email: true, ...personProfileSelect },
        },
      },
    });
    if (!candidate) {
      throw new BadRequestException(
        'Người làm thay phải thuộc ca liền trước và không có ca trùng giờ',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (latestCoverage?.status === StaffShiftCoverageStatus.PENDING) {
        await tx.staffShiftCoverage.update({
          where: { id: latestCoverage.id },
          data: { status: StaffShiftCoverageStatus.CANCELLED },
        });
        await tx.notification.create({
          data: {
            userId: latestCoverage.coveringEmployeeId,
            type: 'SHIFT_COVERAGE_CANCELLED',
            title: 'Phân công làm thay đã hủy',
            message:
              'Trưởng chi nhánh đã đổi người làm thay cho ca ' +
              this.formatShift(request.staffShift.startAt) +
              '.',
          },
        });
      }

      await tx.staffShiftCoverage.create({
        data: {
          leaveRequestId: request.id,
          branchId: manager.managedBranch.id,
          coveringEmployeeId: dto.coveringEmployeeId,
          assignedById: manager.id,
          startAt: request.staffShift.startAt,
          endAt: requestedStartAt,
        },
      });
      await tx.notification.create({
        data: {
          userId: dto.coveringEmployeeId,
          type: 'SHIFT_COVERAGE_ASSIGNED',
          title: 'Đề nghị làm thay đầu ca',
          message:
            'Bạn được đề nghị làm thay từ ' +
            this.formatShift(request.staffShift.startAt) +
            ' đến ' +
            this.formatShift(requestedStartAt) +
            '. Hãy xác nhận trước khi ca bắt đầu.',
        },
      });
      const updated = await tx.staffLeaveRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: this.requestSelect,
      });
      return this.serializeRequest(updated);
    });
  }

  async review(userId: number, requestId: number, dto: ReviewStaffLeaveDto) {
    const manager = await this.getManager(userId);
    const request = await this.prisma.staffLeaveRequest.findFirst({
      where: { id: requestId, branchId: manager.managedBranch.id },
      select: {
        id: true,
        employeeId: true,
        status: true,
        scope: true,
        requestedStartAt: true,
        requestedEndAt: true,
        staffShiftId: true,
        staffShift: { select: { startAt: true, endAt: true } },
      },
    });
    if (!request) {
      throw new NotFoundException(
        'Không tìm thấy yêu cầu nghỉ trong chi nhánh',
      );
    }
    if (request.status !== StaffLeaveStatus.PENDING) {
      throw new BadRequestException('Yêu cầu này đã được xử lý');
    }
    const note = dto.note?.trim() || '';
    if (dto.action !== 'APPROVED' && note.length < 3) {
      throw new BadRequestException(
        'Cần nhập lý do khi từ chối hoặc yêu cầu bổ sung',
      );
    }
    if (
      dto.action === 'APPROVED' &&
      (request.scope === StaffLeaveScope.FULL_SHIFT ||
        request.scope === StaffLeaveScope.LATE_ARRIVAL)
    ) {
      const attendance = await this.prisma.staffAttendance.findFirst({
        where: { scheduledShiftId: request.staffShiftId },
        select: { id: true },
      });
      if (attendance) {
        throw new BadRequestException(
          'Nhân viên đã chấm công ca này nên không thể duyệt nghỉ',
        );
      }
    }

    if (
      dto.coveringEmployeeId &&
      (dto.action !== 'APPROVED' ||
        request.scope !== StaffLeaveScope.LATE_ARRIVAL ||
        !request.requestedStartAt)
    ) {
      throw new BadRequestException(
        'Chỉ được phân công làm thay khi duyệt đơn xin đến trễ',
      );
    }
    if (dto.coveringEmployeeId) {
      const candidate = await this.prisma.staffShift.findFirst({
        where: {
          branchId: manager.managedBranch.id,
          employeeId: {
            equals: dto.coveringEmployeeId,
            not: request.employeeId,
          },
          endAt: request.staffShift.startAt,
          employee: {
            isActive: true,
            role: { name: 'STAFF' },
            scheduledShifts: {
              none: {
                branchId: manager.managedBranch.id,
                startAt: { lt: request.requestedStartAt! },
                endAt: { gt: request.staffShift.startAt },
              },
            },
          },
        },
        select: { id: true },
      });
      if (!candidate) {
        throw new BadRequestException(
          'Người làm thay phải thuộc ca liền trước và không có ca trùng giờ',
        );
      }
    }

    const status = StaffLeaveStatus[dto.action];
    const result = await this.prisma.$transaction(async (tx) => {
      if (
        status === StaffLeaveStatus.APPROVED &&
        request.scope === StaffLeaveScope.LATE_ARRIVAL &&
        request.requestedStartAt &&
        dto.coveringEmployeeId
      ) {
        await tx.staffShiftCoverage.create({
          data: {
            leaveRequestId: request.id,
            branchId: manager.managedBranch.id,
            coveringEmployeeId: dto.coveringEmployeeId,
            assignedById: manager.id,
            startAt: request.staffShift.startAt,
            endAt: request.requestedStartAt,
          },
        });
        await tx.notification.create({
          data: {
            userId: dto.coveringEmployeeId,
            type: 'SHIFT_COVERAGE_ASSIGNED',
            title: 'Đề nghị làm thay đầu ca',
            message: `Bạn được đề nghị làm thay từ ${this.formatShift(request.staffShift.startAt)} đến ${this.formatShift(request.requestedStartAt)}. Hãy xác nhận trước khi ca bắt đầu.`,
          },
        });
      }
      const updated = await tx.staffLeaveRequest.update({
        where: { id: request.id },
        data: {
          status,
          reviewNote: note || null,
          reviewedById: manager.id,
          reviewedAt: new Date(),
        },
        select: this.requestSelect,
      });
      const label =
        status === StaffLeaveStatus.APPROVED
          ? 'được duyệt'
          : status === StaffLeaveStatus.REJECTED
            ? 'bị từ chối'
            : 'cần bổ sung thông tin';
      await tx.notification.create({
        data: {
          userId: request.employeeId,
          type: 'LEAVE_REQUEST_UPDATED',
          title: 'Cập nhật yêu cầu nghỉ / đi trễ / về sớm',
          message: `Yêu cầu ${
            request.scope === StaffLeaveScope.LATE_ARRIVAL
              ? `đến trễ${request.requestedStartAt ? ` lúc ${this.formatShift(request.requestedStartAt)}` : ''}`
              : request.scope === StaffLeaveScope.EARLY_LEAVE
                ? `về sớm${request.requestedEndAt ? ` lúc ${this.formatShift(request.requestedEndAt)}` : ''}`
                : `nghỉ ca ${this.formatShift(request.staffShift.startAt)}`
          } ${label}${note ? `: ${note}` : '.'}`,
        },
      });
      return this.serializeRequest(updated);
    });
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: manager.managedBranch.id,
      module: 'LEAVE',
      action:
        status === StaffLeaveStatus.APPROVED
          ? 'APPROVE_LEAVE'
          : status === StaffLeaveStatus.REJECTED
            ? 'REJECT_LEAVE'
            : 'REQUEST_LEAVE_INFO',
      entityType: 'StaffLeaveRequest',
      entityId: request.id,
      description: `Xử lý yêu cầu xin phép #${request.id} của nhân viên #${request.employeeId}`,
      beforeData: { status: request.status },
      afterData: {
        status,
        note: note || null,
        coveringEmployeeId: dto.coveringEmployeeId ?? null,
      },
    });
    return result;
  }

  async respondCoverage(
    userId: number,
    coverageId: number,
    dto: RespondShiftCoverageDto,
  ) {
    const staff = await this.getStaff(userId);
    const coverage = await this.prisma.staffShiftCoverage.findFirst({
      where: {
        id: coverageId,
        coveringEmployeeId: staff.id,
        branchId: staff.branch.id,
      },
      select: {
        id: true,
        status: true,
        startAt: true,
        endAt: true,
        leaveRequest: {
          select: {
            employee: {
              select: { id: true, email: true, ...personProfileSelect },
            },
          },
        },
      },
    });
    if (!coverage) {
      throw new NotFoundException('Không tìm thấy phân công làm thay');
    }
    if (coverage.status !== StaffShiftCoverageStatus.PENDING) {
      throw new BadRequestException('Phân công này đã được phản hồi');
    }
    if (dto.action === 'ACCEPTED' && Date.now() >= coverage.startAt.getTime()) {
      throw new BadRequestException(
        'Đã tới giờ bắt đầu; hãy liên hệ trưởng chi nhánh để ghi nhận thủ công',
      );
    }

    const respondedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.staffShiftCoverage.update({
        where: { id: coverage.id },
        data: {
          status: StaffShiftCoverageStatus[dto.action],
          respondedAt,
        },
        select: {
          id: true,
          leaveRequestId: true,
          startAt: true,
          endAt: true,
          actualEndAt: true,
          status: true,
          respondedAt: true,
        },
      });
      if (staff.branch.managerId) {
        await tx.notification.create({
          data: {
            userId: staff.branch.managerId,
            type: 'SHIFT_COVERAGE_RESPONDED',
            title: 'Phản hồi phân công làm thay',
            message: `${staff.fullName || staff.email} đã ${dto.action === 'ACCEPTED' ? 'nhận' : 'từ chối'} làm thay cho ${flattenPersonProfile(coverage.leaveRequest.employee).fullName || coverage.leaveRequest.employee.email}.`,
          },
        });
      }
      return updated;
    });
  }
}
