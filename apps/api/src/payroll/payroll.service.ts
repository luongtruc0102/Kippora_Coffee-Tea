import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  StaffAttendancePeriodStatus,
  StaffLeaveStatus,
  StaffLeaveScope,
  StaffPayrollAdjustmentType,
  StaffPayrollStatus,
} from '../../generated/prisma/enums';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePayrollAdjustmentDto } from './dto/create-payroll-adjustment.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { MarkPayrollPaidDto } from './dto/mark-payroll-paid.dto';
import { UpdateStaffRateDto } from './dto/update-staff-rate.dto';
import { UpdateRoleRatesDto } from './dto/update-role-rates.dto';
import {
  calculateAbsenceDeductionAmount,
  calculateEarlyLeaveDeductionAmount,
  calculateEarlyLeaveMinutes,
  calculateLateDeductionAmount,
  calculateUnexcusedLateMinutes,
  calculatePayrollAmounts,
  getPayrollMonthRange,
} from './payroll.util';
import { classifyPayrollAttendances } from './payroll-attendance.util';
import {
  synchronizeBranchAttendances,
  synchronizeEmployeeAttendance,
} from '../staff-schedules/attendance-automation';

const DEFAULT_HOURLY_RATE = 32_000;
const DEFAULT_OVERTIME_MULTIPLIER = 1.5;
const DEFAULT_ABSENCE_PENALTY_RATE = 0.5;

const payrollPeriodInclude = {
  branch: {
    select: { id: true, code: true, name: true, isActive: true },
  },
  finalizedBy: {
    select: { id: true, email: true, ...personProfileSelect },
  },
  paidBy: {
    select: { id: true, email: true, ...personProfileSelect },
  },
  attendancePeriod: {
    include: {
      submittedBy: {
        select: { id: true, email: true, ...personProfileSelect },
      },
      reviewedBy: {
        select: { id: true, email: true, ...personProfileSelect },
      },
    },
  },
  entries: {
    include: {
      employee: {
        select: {
          id: true,
          email: true,
          isActive: true,
          role: { select: { name: true } },
          ...personProfileSelect,
          staffProfile: {
            select: { hourlyRate: true, overtimeMultiplier: true },
          },
        },
      },
      adjustments: {
        include: {
          createdBy: {
            select: { id: true, email: true, ...personProfileSelect },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { employeeId: 'asc' },
  },
} satisfies Prisma.StaffPayrollPeriodInclude;

type PayrollPeriodWithRelations = Prisma.StaffPayrollPeriodGetPayload<{
  include: typeof payrollPeriodInclude;
}>;

type PayrollMetrics = {
  regularSeconds: number;
  overtimeSeconds: number;
  scheduledShifts: number;
  completedShifts: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  unexcusedEarlyLeaveMinutes: number;
  absentShifts: number;
  unexcusedAbsentSeconds: number;
  excusedLeaveShifts: number;
  openAttendances: number;
};

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private emptyMetrics(): PayrollMetrics {
    return {
      regularSeconds: 0,
      overtimeSeconds: 0,
      scheduledShifts: 0,
      completedShifts: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      unexcusedEarlyLeaveMinutes: 0,
      absentShifts: 0,
      unexcusedAbsentSeconds: 0,
      excusedLeaveShifts: 0,
      openAttendances: 0,
    };
  }

  private async getManagedBranch(managerUserId: number) {
    const manager = await this.prisma.user.findUnique({
      where: { id: managerUserId },
      select: {
        isActive: true,
        role: { select: { name: true } },
        staffProfile: { select: { branchId: true } },
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
    return manager.managedBranch;
  }

  private async resolveBranch(
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
      throw new ForbiddenException('Tài khoản không có quyền xem bảng lương');
    }
    if (!requestedBranchId) {
      throw new BadRequestException('Vui lòng chọn chi nhánh cần xem');
    }

    const branch = await this.prisma.storeBranch.findUnique({
      where: { id: requestedBranchId },
      select: { id: true, code: true, name: true, isActive: true },
    });
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');
    return branch;
  }

  private async loadPeriod(id: number) {
    const period = await this.prisma.staffPayrollPeriod.findUnique({
      where: { id },
      include: payrollPeriodInclude,
    });
    if (!period) throw new NotFoundException('Không tìm thấy kỳ lương');
    return period;
  }

  private serializePeriod(
    period: PayrollPeriodWithRelations,
    personalEmployeeId?: number,
  ) {
    const entries = period.entries
      .filter(
        (entry) =>
          !personalEmployeeId || entry.employeeId === personalEmployeeId,
      )
      .map((entry) => {
        const manualDeductionAmount = Number(entry.deductionAmount);
        const lateDeductionAmount = Number(entry.lateDeductionAmount);
        const earlyLeaveDeductionAmount = Number(
          entry.earlyLeaveDeductionAmount,
        );
        const absenceDeductionAmount = Number(entry.absenceDeductionAmount);
        return {
          ...entry,
          employee: {
            ...flattenPersonProfile(entry.employee),
            role: entry.employee.role.name,
            hourlyRate: Number(
              entry.employee.staffProfile?.hourlyRate ??
                entry.hourlyRateSnapshot,
            ),
            overtimeMultiplier: Number(
              entry.employee.staffProfile?.overtimeMultiplier ??
                entry.overtimeMultiplierSnapshot,
            ),
            staffProfile: undefined,
          },
          hourlyRateSnapshot: Number(entry.hourlyRateSnapshot),
          overtimeMultiplierSnapshot: Number(entry.overtimeMultiplierSnapshot),
          baseAmount: Number(entry.baseAmount),
          overtimeAmount: Number(entry.overtimeAmount),
          bonusAmount: Number(entry.bonusAmount),
          deductionAmount: manualDeductionAmount,
          lateDeductionAmount,
          earlyLeaveDeductionAmount,
          absenceDeductionAmount,
          totalDeductionAmount:
            manualDeductionAmount +
            lateDeductionAmount +
            earlyLeaveDeductionAmount +
            absenceDeductionAmount,
          totalAmount: Number(entry.totalAmount),
          adjustments: entry.adjustments.map((adjustment) => ({
            ...adjustment,
            amount: Number(adjustment.amount),
            createdBy: adjustment.createdBy
              ? flattenPersonProfile(adjustment.createdBy)
              : null,
          })),
        };
      })
      .sort((left, right) =>
        (left.employee.fullName || left.employee.email).localeCompare(
          right.employee.fullName || right.employee.email,
          'vi',
        ),
      );

    const summary = entries.reduce(
      (result, entry) => ({
        employees: result.employees + 1,
        regularSeconds: result.regularSeconds + entry.regularSeconds,
        overtimeSeconds: result.overtimeSeconds + entry.overtimeSeconds,
        baseAmount: result.baseAmount + entry.baseAmount,
        overtimeAmount: result.overtimeAmount + entry.overtimeAmount,
        bonusAmount: result.bonusAmount + entry.bonusAmount,
        deductionAmount: result.deductionAmount + entry.deductionAmount,
        lateDeductionAmount:
          result.lateDeductionAmount + entry.lateDeductionAmount,
        earlyLeaveDeductionAmount:
          result.earlyLeaveDeductionAmount + entry.earlyLeaveDeductionAmount,
        absenceDeductionAmount:
          result.absenceDeductionAmount + entry.absenceDeductionAmount,
        totalDeductionAmount:
          result.totalDeductionAmount + entry.totalDeductionAmount,
        totalAmount: result.totalAmount + entry.totalAmount,
      }),
      {
        employees: 0,
        regularSeconds: 0,
        overtimeSeconds: 0,
        baseAmount: 0,
        overtimeAmount: 0,
        bonusAmount: 0,
        deductionAmount: 0,
        lateDeductionAmount: 0,
        earlyLeaveDeductionAmount: 0,
        absenceDeductionAmount: 0,
        totalDeductionAmount: 0,
        totalAmount: 0,
      },
    );

    return {
      id: period.id,
      branch: period.branch,
      month: period.periodStart.toISOString().slice(0, 7),
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: period.status,
      generatedAt: period.updatedAt,
      finalizedAt: period.finalizedAt,
      finalizedBy: period.finalizedBy
        ? flattenPersonProfile(period.finalizedBy)
        : null,
      paidAt: period.paidAt,
      paidBy: period.paidBy ? flattenPersonProfile(period.paidBy) : null,
      paymentMethod: period.paymentMethod,
      paymentReference: period.paymentReference,
      attendanceReview: period.attendancePeriod
        ? {
            id: period.attendancePeriod.id,
            status: period.attendancePeriod.status,
            revision: period.attendancePeriod.revision,
            submittedAt: period.attendancePeriod.submittedAt,
            submittedBy: period.attendancePeriod.submittedBy
              ? flattenPersonProfile(period.attendancePeriod.submittedBy)
              : null,
            reviewedAt: period.attendancePeriod.reviewedAt,
            reviewedBy: period.attendancePeriod.reviewedBy
              ? flattenPersonProfile(period.attendancePeriod.reviewedBy)
              : null,
            reviewNote: period.attendancePeriod.reviewNote,
          }
        : null,
      canFinalize:
        period.periodEnd.getTime() <= Date.now() &&
        period.attendancePeriod?.status ===
          StaffAttendancePeriodStatus.APPROVED,
      summary,
      entries,
      rules: {
        minimumHourlyRate: 25_500,
        defaultHourlyRate: DEFAULT_HOURLY_RATE,
        defaultOvertimeMultiplier: DEFAULT_OVERTIME_MULTIPLIER,
        absencePenaltyRate: DEFAULT_ABSENCE_PENALTY_RATE,
      },
    };
  }

  private async recalculateEntry(entryId: number) {
    const entry = await this.prisma.staffPayrollEntry.findUnique({
      where: { id: entryId },
      include: { adjustments: true },
    });
    if (!entry) throw new NotFoundException('Không tìm thấy dòng lương');

    const bonusAmount = entry.adjustments
      .filter((item) => item.type === StaffPayrollAdjustmentType.BONUS)
      .reduce((total, item) => total + Number(item.amount), 0);
    const deductionAmount = entry.adjustments
      .filter((item) => item.type === StaffPayrollAdjustmentType.DEDUCTION)
      .reduce((total, item) => total + Number(item.amount), 0);
    const amounts = calculatePayrollAmounts({
      regularSeconds: entry.regularSeconds,
      overtimeSeconds: entry.overtimeSeconds,
      hourlyRate: Number(entry.hourlyRateSnapshot),
      overtimeMultiplier: Number(entry.overtimeMultiplierSnapshot),
      bonusAmount,
      deductionAmount,
      lateDeductionAmount: Number(entry.lateDeductionAmount),
      earlyLeaveDeductionAmount: Number(entry.earlyLeaveDeductionAmount),
      absenceDeductionAmount: Number(entry.absenceDeductionAmount),
    });

    await this.prisma.staffPayrollEntry.update({
      where: { id: entry.id },
      data: { bonusAmount, deductionAmount, ...amounts },
    });
  }

  async generate(
    viewerId: number,
    viewerRole: string,
    dto: GeneratePayrollDto,
    personalEmployeeId?: number,
  ) {
    const branch = await this.resolveBranch(viewerId, viewerRole, dto.branchId);
    if (personalEmployeeId) {
      await synchronizeEmployeeAttendance(
        this.prisma,
        personalEmployeeId,
        branch.id,
      );
    } else {
      await synchronizeBranchAttendances(this.prisma, branch.id);
    }
    const range = getPayrollMonthRange(dto.month);
    let period = await this.prisma.staffPayrollPeriod.upsert({
      where: {
        branchId_periodStart: {
          branchId: branch.id,
          periodStart: range.periodStart,
        },
      },
      create: {
        branchId: branch.id,
        periodStart: range.periodStart,
        periodEnd: range.periodEnd,
      },
      update: {},
      include: payrollPeriodInclude,
    });

    const attendancePeriod = await this.prisma.staffAttendancePeriod.findUnique(
      {
        where: {
          branchId_periodStart: {
            branchId: branch.id,
            periodStart: range.periodStart,
          },
        },
        select: { id: true },
      },
    );
    if (attendancePeriod && period.attendancePeriodId !== attendancePeriod.id) {
      period = await this.prisma.staffPayrollPeriod.update({
        where: { id: period.id },
        data: { attendancePeriodId: attendancePeriod.id },
        include: payrollPeriodInclude,
      });
    }

    if (period.status !== StaffPayrollStatus.DRAFT) {
      return this.serializePeriod(period, personalEmployeeId);
    }

    const [employees, attendances, shifts] = await Promise.all([
      this.prisma.user.findMany({
        where: personalEmployeeId
          ? {
              id: personalEmployeeId,
              role: { name: 'STAFF' },
              staffProfile: { branchId: branch.id },
            }
          : {
              role: { name: { in: ['STAFF', 'BRANCH_MANAGER'] } },
              OR: [
                { staffProfile: { branchId: branch.id } },
                {
                  attendanceRecords: {
                    some: {
                      branchId: branch.id,
                      clockIn: { gte: range.rangeStart, lt: range.rangeEnd },
                    },
                  },
                },
                {
                  scheduledShifts: {
                    some: {
                      branchId: branch.id,
                      startAt: { gte: range.rangeStart, lt: range.rangeEnd },
                    },
                  },
                },
              ],
            },
        select: {
          id: true,
          email: true,
          isActive: true,
          ...personProfileSelect,
          staffProfile: {
            select: { hourlyRate: true, overtimeMultiplier: true },
          },
        },
      }),
      this.prisma.staffAttendance.findMany({
        where: {
          branchId: branch.id,
          ...(personalEmployeeId
            ? { employeeId: personalEmployeeId }
            : {}),
          clockIn: { gte: range.rangeStart, lt: range.rangeEnd },
        },
        select: {
          employeeId: true,
          scheduledShiftId: true,
          clockIn: true,
          clockOut: true,
          scheduledShift: {
            select: {
              startAt: true,
              endAt: true,
              leaveRequests: {
                where: {
                  status: StaffLeaveStatus.APPROVED,
                  scope: {
                    in: [
                      StaffLeaveScope.EARLY_LEAVE,
                      StaffLeaveScope.LATE_ARRIVAL,
                    ],
                  },
                },
                select: {
                  scope: true,
                  requestedStartAt: true,
                  requestedEndAt: true,
                },
                take: 1,
              },
            },
          },
        },
        orderBy: { clockIn: 'asc' },
      }),
      this.prisma.staffShift.findMany({
        where: {
          branchId: branch.id,
          ...(personalEmployeeId
            ? { employeeId: personalEmployeeId }
            : {}),
          startAt: { gte: range.rangeStart, lt: range.rangeEnd },
        },
        select: {
          id: true,
          employeeId: true,
          startAt: true,
          endAt: true,
          leaveRequests: {
            where: { status: StaffLeaveStatus.APPROVED },
            select: {
              id: true,
              scope: true,
              requestedStartAt: true,
              requestedEndAt: true,
            },
            take: 1,
          },
        },
      }),
    ]);

    const metrics = new Map<number, PayrollMetrics>();
    for (const employee of employees) {
      metrics.set(employee.id, this.emptyMetrics());
    }

    const attendanceByShift = new Map<number, (typeof attendances)[number]>();
    const lastClosedAttendanceByShift = new Map<
      number,
      (typeof attendances)[number]
    >();
    const lateRecordedShiftIds = new Set<number>();
    for (const attendance of attendances) {
      const current = metrics.get(attendance.employeeId) ?? this.emptyMetrics();
      if (attendance.scheduledShiftId) {
        attendanceByShift.set(attendance.scheduledShiftId, attendance);
      }
      if (!attendance.clockOut) {
        current.openAttendances += 1;
        metrics.set(attendance.employeeId, current);
        continue;
      }
      if (attendance.scheduledShiftId && attendance.scheduledShift) {
        const previous = lastClosedAttendanceByShift.get(
          attendance.scheduledShiftId,
        );
        if (
          !previous?.clockOut ||
          attendance.clockOut.getTime() > previous.clockOut.getTime()
        ) {
          lastClosedAttendanceByShift.set(
            attendance.scheduledShiftId,
            attendance,
          );
        }
      }

      const workedSeconds = Math.max(
        0,
        Math.floor(
          (attendance.clockOut.getTime() - attendance.clockIn.getTime()) / 1000,
        ),
      );
      const overtimeSeconds = attendance.scheduledShift
        ? Math.max(
            0,
            Math.floor(
              (attendance.clockOut.getTime() -
                attendance.scheduledShift.endAt.getTime()) /
                1000,
            ),
          )
        : 0;
      current.regularSeconds += Math.max(0, workedSeconds - overtimeSeconds);
      current.overtimeSeconds += overtimeSeconds;
      current.completedShifts += 1;
      if (attendance.scheduledShift) {
        if (
          attendance.scheduledShiftId &&
          !lateRecordedShiftIds.has(attendance.scheduledShiftId)
        ) {
          const approvedLateRequest =
            attendance.scheduledShift.leaveRequests[0]?.scope ===
            StaffLeaveScope.LATE_ARRIVAL
              ? attendance.scheduledShift.leaveRequests[0]
              : null;
          current.lateMinutes += calculateUnexcusedLateMinutes({
            shiftStartAt: attendance.scheduledShift.startAt,
            clockInAt: attendance.clockIn,
            approvedArrivalAt: approvedLateRequest?.requestedStartAt,
          });
          lateRecordedShiftIds.add(attendance.scheduledShiftId);
        }
      }
      metrics.set(attendance.employeeId, current);
    }

    for (const attendance of lastClosedAttendanceByShift.values()) {
      if (!attendance.clockOut || !attendance.scheduledShift) continue;
      const current = metrics.get(attendance.employeeId) ?? this.emptyMetrics();
      const approvedEndAt =
        attendance.scheduledShift.leaveRequests[0]?.requestedEndAt;
      const { earlyLeaveMinutes, unexcusedEarlyLeaveMinutes } =
        calculateEarlyLeaveMinutes({
          shiftEndAt: attendance.scheduledShift.endAt,
          clockOutAt: attendance.clockOut,
          approvedEndAt,
        });
      current.earlyLeaveMinutes += earlyLeaveMinutes;
      current.unexcusedEarlyLeaveMinutes += unexcusedEarlyLeaveMinutes;
      metrics.set(attendance.employeeId, current);
    }

    const now = new Date();
    for (const shift of shifts) {
      const current = metrics.get(shift.employeeId) ?? this.emptyMetrics();
      current.scheduledShifts += 1;
      if (!attendanceByShift.has(shift.id)) {
        if (
          shift.leaveRequests.some(
            (request) => request.scope === StaffLeaveScope.FULL_SHIFT,
          )
        ) {
          current.excusedLeaveShifts += 1;
        } else if (shift.endAt < now) {
          current.absentShifts += 1;
          current.unexcusedAbsentSeconds += Math.max(
            0,
            Math.floor(
              (shift.endAt.getTime() - shift.startAt.getTime()) / 1000,
            ),
          );
        }
      }
      metrics.set(shift.employeeId, current);
    }

    const existingByEmployee = new Map(
      period.entries.map((entry) => [entry.employeeId, entry]),
    );
    const operations = employees.map((employee) => {
      const current = metrics.get(employee.id) ?? this.emptyMetrics();
      const existing = existingByEmployee.get(employee.id);
      const bonusAmount = existing
        ? existing.adjustments
            .filter((item) => item.type === StaffPayrollAdjustmentType.BONUS)
            .reduce((total, item) => total + Number(item.amount), 0)
        : 0;
      const deductionAmount = existing
        ? existing.adjustments
            .filter(
              (item) => item.type === StaffPayrollAdjustmentType.DEDUCTION,
            )
            .reduce((total, item) => total + Number(item.amount), 0)
        : 0;
      const hourlyRate = Number(
        employee.staffProfile?.hourlyRate ?? DEFAULT_HOURLY_RATE,
      );
      const overtimeMultiplier = Number(
        employee.staffProfile?.overtimeMultiplier ??
          DEFAULT_OVERTIME_MULTIPLIER,
      );
      const lateDeductionAmount = calculateLateDeductionAmount(
        current.lateMinutes,
        hourlyRate,
      );
      const earlyLeaveDeductionAmount = calculateEarlyLeaveDeductionAmount(
        current.unexcusedEarlyLeaveMinutes,
        hourlyRate,
      );
      const absenceDeductionAmount = calculateAbsenceDeductionAmount(
        current.unexcusedAbsentSeconds,
        hourlyRate,
        DEFAULT_ABSENCE_PENALTY_RATE,
      );
      const amounts = calculatePayrollAmounts({
        regularSeconds: current.regularSeconds,
        overtimeSeconds: current.overtimeSeconds,
        hourlyRate,
        overtimeMultiplier,
        bonusAmount,
        deductionAmount,
        lateDeductionAmount,
        earlyLeaveDeductionAmount,
        absenceDeductionAmount,
      });
      const data = {
        hourlyRateSnapshot: hourlyRate,
        overtimeMultiplierSnapshot: overtimeMultiplier,
        regularSeconds: current.regularSeconds,
        overtimeSeconds: current.overtimeSeconds,
        scheduledShifts: current.scheduledShifts,
        completedShifts: current.completedShifts,
        attendanceBreakdown: {
          ...classifyPayrollAttendances(
            attendances.filter(
              (attendance) => attendance.employeeId === employee.id,
            ),
            shifts
              .filter((shift) => shift.employeeId === employee.id)
              .map((shift) => shift.id),
          ),
        },
        lateMinutes: current.lateMinutes,
        earlyLeaveMinutes: current.earlyLeaveMinutes,
        unexcusedEarlyLeaveMinutes: current.unexcusedEarlyLeaveMinutes,
        absentShifts: current.absentShifts,
        unexcusedAbsentSeconds: current.unexcusedAbsentSeconds,
        excusedLeaveShifts: current.excusedLeaveShifts,
        bonusAmount,
        deductionAmount,
        lateDeductionAmount,
        earlyLeaveDeductionAmount,
        absenceDeductionAmount,
        ...amounts,
      };
      return this.prisma.staffPayrollEntry.upsert({
        where: {
          payrollPeriodId_employeeId: {
            payrollPeriodId: period.id,
            employeeId: employee.id,
          },
        },
        create: {
          payrollPeriodId: period.id,
          employeeId: employee.id,
          ...data,
        },
        update: data,
      });
    });
    if (operations.length > 0) await this.prisma.$transaction(operations);
    await this.prisma.staffPayrollPeriod.update({
      where: { id: period.id },
      data: { updatedAt: new Date() },
    });

    period = await this.loadPeriod(period.id);
    return {
      ...this.serializePeriod(period, personalEmployeeId),
      openAttendances: personalEmployeeId
        ? (metrics.get(personalEmployeeId)?.openAttendances ?? 0)
        : [...metrics.values()].reduce(
            (total, item) => total + item.openAttendances,
            0,
          ),
    };
  }

  async getMine(staffUserId: number, month: string) {
    const branch = await this.resolveBranch(staffUserId, 'STAFF_SELF');
    const range = getPayrollMonthRange(month);
    const lockedPeriod = await this.prisma.staffPayrollPeriod.findUnique({
      where: {
        branchId_periodStart: {
          branchId: branch.id,
          periodStart: range.periodStart,
        },
      },
      include: payrollPeriodInclude,
    });
    if (
      lockedPeriod &&
      lockedPeriod.status !== StaffPayrollStatus.DRAFT
    ) {
      return this.serializePeriod(lockedPeriod, staffUserId);
    }
    return this.generate(
      staffUserId,
      'STAFF_SELF',
      { month },
      staffUserId,
    );
  }

  async updateRate(
    viewerId: number,
    viewerRole: string,
    employeeId: number,
    dto: UpdateStaffRateDto,
  ) {
    if (viewerRole !== 'ADMIN') {
      throw new ForbiddenException('Chỉ ADMIN được chỉnh mức lương nhân viên');
    }
    const employee = await this.prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        staffProfile: {
          select: {
            branchId: true,
            hourlyRate: true,
            overtimeMultiplier: true,
          },
        },
        role: { select: { name: true } },
      },
    });
    if (!employee?.staffProfile?.branchId) {
      throw new NotFoundException('Không tìm thấy hồ sơ nhân viên');
    }
    await this.resolveBranch(
      viewerId,
      viewerRole,
      employee.staffProfile.branchId,
    );
    if (!['STAFF', 'BRANCH_MANAGER'].includes(employee.role.name)) {
      throw new BadRequestException('Tài khoản không phải nhân sự');
    }

    const updated = await this.prisma.staffProfile.update({
      where: { userId: employee.id },
      data: {
        hourlyRate: dto.hourlyRate,
        overtimeMultiplier: dto.overtimeMultiplier,
      },
    });
    const result = {
      employeeId: updated.userId,
      hourlyRate: Number(updated.hourlyRate),
      overtimeMultiplier: Number(updated.overtimeMultiplier),
    };
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: employee.staffProfile.branchId,
      module: 'PAYROLL',
      action: 'UPDATE_EMPLOYEE_RATE',
      entityType: 'StaffProfile',
      entityId: employee.id,
      description: `Cập nhật mức lương nhân viên #${employee.id}`,
      beforeData: {
        hourlyRate: Number(employee.staffProfile.hourlyRate),
        overtimeMultiplier: Number(
          employee.staffProfile.overtimeMultiplier,
        ),
      },
      afterData: result,
    });
    return result;
  }

  async updateRoleRates(
    viewerId: number,
    viewerRole: string,
    dto: UpdateRoleRatesDto,
  ) {
    if (viewerRole !== 'ADMIN') {
      throw new ForbiddenException('Chỉ ADMIN được cập nhật lương hàng loạt');
    }
    const branch = await this.resolveBranch(viewerId, viewerRole, dto.branchId);
    const [staff, managers] = await this.prisma.$transaction([
      this.prisma.staffProfile.updateMany({
        where: {
          branchId: branch.id,
          user: { isActive: true, role: { name: 'STAFF' } },
        },
        data: {
          hourlyRate: dto.staff.hourlyRate,
          overtimeMultiplier: dto.staff.overtimeMultiplier,
        },
      }),
      this.prisma.staffProfile.updateMany({
        where: {
          branchId: branch.id,
          user: { isActive: true, role: { name: 'BRANCH_MANAGER' } },
        },
        data: {
          hourlyRate: dto.manager.hourlyRate,
          overtimeMultiplier: dto.manager.overtimeMultiplier,
        },
      }),
    ]);

    const result = {
      branch,
      updated: {
        staff: staff.count,
        managers: managers.count,
      },
      rates: {
        staff: dto.staff,
        manager: dto.manager,
      },
    };
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: branch.id,
      module: 'PAYROLL',
      action: 'UPDATE_ROLE_RATES',
      entityType: 'StaffProfile',
      entityId: branch.id,
      description: `Cập nhật lương chung của ${branch.code}`,
      afterData: {
        rates: result.rates,
        updated: result.updated,
      },
    });
    return result;
  }

  private async getEditableEntry(
    viewerId: number,
    viewerRole: string,
    entryId: number,
  ) {
    const entry = await this.prisma.staffPayrollEntry.findUnique({
      where: { id: entryId },
      include: { payrollPeriod: true },
    });
    if (!entry) throw new NotFoundException('Không tìm thấy dòng lương');
    await this.resolveBranch(
      viewerId,
      viewerRole,
      entry.payrollPeriod.branchId,
    );
    if (entry.payrollPeriod.status !== StaffPayrollStatus.DRAFT) {
      throw new ConflictException('Kỳ lương đã chốt, không thể chỉnh sửa');
    }
    return entry;
  }

  async createAdjustment(
    viewerId: number,
    viewerRole: string,
    entryId: number,
    dto: CreatePayrollAdjustmentDto,
  ) {
    const entry = await this.getEditableEntry(viewerId, viewerRole, entryId);
    const adjustment = await this.prisma.staffPayrollAdjustment.create({
      data: {
        payrollEntryId: entry.id,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason.trim(),
        createdById: viewerId,
      },
    });
    await this.recalculateEntry(entry.id);
    const result = this.serializePeriod(
      await this.loadPeriod(entry.payrollPeriodId),
    );
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: entry.payrollPeriod.branchId,
      module: 'PAYROLL',
      action: 'CREATE_ADJUSTMENT',
      entityType: 'StaffPayrollAdjustment',
      entityId: adjustment.id,
      description: `Thêm khoản ${dto.type === 'BONUS' ? 'thưởng' : 'khấu trừ'} vào dòng lương #${entry.id}`,
      afterData: {
        payrollEntryId: entry.id,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason.trim(),
      },
    });
    return result;
  }

  async deleteAdjustment(
    viewerId: number,
    viewerRole: string,
    adjustmentId: number,
  ) {
    const adjustment = await this.prisma.staffPayrollAdjustment.findUnique({
      where: { id: adjustmentId },
      select: {
        id: true,
        payrollEntryId: true,
        type: true,
        amount: true,
        reason: true,
      },
    });
    if (!adjustment) {
      throw new NotFoundException('Không tìm thấy khoản điều chỉnh');
    }
    const entry = await this.getEditableEntry(
      viewerId,
      viewerRole,
      adjustment.payrollEntryId,
    );
    await this.prisma.staffPayrollAdjustment.delete({
      where: { id: adjustment.id },
    });
    await this.recalculateEntry(entry.id);
    const result = this.serializePeriod(
      await this.loadPeriod(entry.payrollPeriodId),
    );
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: entry.payrollPeriod.branchId,
      module: 'PAYROLL',
      action: 'DELETE_ADJUSTMENT',
      entityType: 'StaffPayrollAdjustment',
      entityId: adjustment.id,
      description: `Xóa khoản điều chỉnh khỏi dòng lương #${entry.id}`,
      beforeData: adjustment,
      afterData: { deleted: true },
    });
    return result;
  }

  async finalize(viewerId: number, viewerRole: string, periodId: number) {
    if (viewerRole !== 'ADMIN') {
      throw new ForbiddenException('Chỉ ADMIN được chốt bảng lương');
    }

    const current = await this.loadPeriod(periodId);
    await this.resolveBranch(viewerId, viewerRole, current.branchId);
    if (current.status !== StaffPayrollStatus.DRAFT) {
      throw new ConflictException('Kỳ lương đã được chốt trước đó');
    }

    if (
      !current.attendancePeriod ||
      current.attendancePeriod.status !==
        StaffAttendancePeriodStatus.APPROVED ||
      current.attendancePeriod.periodStart.getTime() !==
        current.periodStart.getTime()
    ) {
      throw new BadRequestException(
        'Bảng công tháng này chưa được Admin duyệt nên chưa thể chốt lương',
      );
    }

    const month = current.periodStart.toISOString().slice(0, 7);
    const range = getPayrollMonthRange(month);
    if (range.rangeEnd.getTime() > Date.now()) {
      throw new BadRequestException(
        'Chỉ được chốt bảng lương sau khi tháng đã kết thúc',
      );
    }
    const openAttendance = await this.prisma.staffAttendance.findFirst({
      where: {
        branchId: current.branchId,
        clockIn: { lt: range.rangeEnd },
        clockOut: null,
      },
      select: { id: true },
    });
    if (openAttendance) {
      throw new BadRequestException(
        'Vẫn còn ca chưa kết thúc trong kỳ lương này',
      );
    }

    await this.generate(viewerId, viewerRole, {
      month,
      branchId: current.branchId,
    });
    const claimed = await this.prisma.staffPayrollPeriod.updateMany({
      where: { id: periodId, status: StaffPayrollStatus.DRAFT },
      data: {
        status: StaffPayrollStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedById: viewerId,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Kỳ lương vừa được chốt, vui lòng tải lại');
    }
    const finalized = await this.loadPeriod(periodId);
    const recipientIds = [
      ...new Set(finalized.entries.map((entry) => entry.employeeId)),
    ];
    if (recipientIds.length) {
      await this.prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          type: 'PAYROLL_FINALIZED',
          title: 'Bảng lương đã được chốt',
          message: `Lương tháng ${month} đã được Admin chốt. Bạn có thể xem và tải phiếu lương chính thức.`,
        })),
      });
    }
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: finalized.branchId,
      module: 'PAYROLL',
      action: 'FINALIZE_PAYROLL',
      entityType: 'StaffPayrollPeriod',
      entityId: finalized.id,
      description: `Chốt bảng lương tháng ${month}`,
      beforeData: { status: 'DRAFT' },
      afterData: {
        status: finalized.status,
        finalizedAt: finalized.finalizedAt,
        employees: finalized.entries.length,
      },
    });
    return this.serializePeriod(finalized);
  }

  async markPaid(
    viewerId: number,
    viewerRole: string,
    periodId: number,
    dto: MarkPayrollPaidDto,
  ) {
    if (viewerRole !== 'ADMIN') {
      throw new ForbiddenException('Chỉ ADMIN được xác nhận thanh toán lương');
    }

    const current = await this.loadPeriod(periodId);
    await this.resolveBranch(viewerId, viewerRole, current.branchId);
    if (current.status === StaffPayrollStatus.DRAFT) {
      throw new BadRequestException(
        'Cần chốt bảng lương trước khi xác nhận thanh toán',
      );
    }
    if (current.status === StaffPayrollStatus.PAID) {
      throw new ConflictException('Kỳ lương đã được thanh toán trước đó');
    }

    const claimed = await this.prisma.staffPayrollPeriod.updateMany({
      where: { id: periodId, status: StaffPayrollStatus.FINALIZED },
      data: {
        status: StaffPayrollStatus.PAID,
        paidAt: new Date(),
        paidById: viewerId,
        paymentMethod: dto.method,
        paymentReference: dto.reference?.trim() || null,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Trạng thái kỳ lương vừa thay đổi, vui lòng tải lại',
      );
    }
    const paid = await this.loadPeriod(periodId);
    const recipientIds = [
      ...new Set(paid.entries.map((entry) => entry.employeeId)),
    ];
    if (recipientIds.length) {
      await this.prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          type: 'PAYROLL_PAID',
          title: 'Lương đã được thanh toán',
          message: `Lương tháng ${paid.periodStart.toISOString().slice(0, 7)} đã được xác nhận thanh toán.`,
        })),
      });
    }
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: paid.branchId,
      module: 'PAYROLL',
      action: 'MARK_PAYROLL_PAID',
      entityType: 'StaffPayrollPeriod',
      entityId: paid.id,
      description: `Xác nhận thanh toán lương tháng ${paid.periodStart.toISOString().slice(0, 7)}`,
      beforeData: { status: 'FINALIZED' },
      afterData: {
        status: paid.status,
        paidAt: paid.paidAt,
        paymentMethod: paid.paymentMethod,
        paymentReference: paid.paymentReference,
      },
    });
    return this.serializePeriod(paid);
  }
}
