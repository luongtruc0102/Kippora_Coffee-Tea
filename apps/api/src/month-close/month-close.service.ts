import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import { PrismaService } from '../prisma/prisma.service';
import { ProfitabilityService } from '../profitability/profitability.service';
import { CloseMonthDto } from './dto/close-month.dto';
import { MonthCloseQueryDto } from './dto/month-close-query.dto';
import { ReopenMonthDto } from './dto/reopen-month.dto';

const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

type Branch = {
  id: number;
  code: string;
  name: string;
  managerId: number | null;
};

type ReadinessItem = {
  code: string;
  label: string;
  count: number;
  href: string | null;
};

function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const periodStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const periodEnd = new Date(Date.UTC(year, monthNumber, 1));
  const lastDay = new Date(periodEnd.getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  return {
    periodStart,
    periodEnd,
    from: `${month}-01`,
    to: lastDay,
  };
}

function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class MonthCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profitabilityService: ProfitabilityService,
  ) {}

  private async resolveBranch(
    viewerId: number,
    viewerRole: string,
    requestedBranchId?: number,
  ): Promise<Branch> {
    if (viewerRole === 'ADMIN') {
      if (!requestedBranchId) {
        throw new BadRequestException('Vui lòng chọn chi nhánh cần chốt sổ');
      }
      const branch = await this.prisma.storeBranch.findUnique({
        where: { id: requestedBranchId },
        select: { id: true, code: true, name: true, managerId: true },
      });
      if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');
      return branch;
    }

    if (viewerRole !== 'BRANCH_MANAGER') {
      throw new ForbiddenException('Bạn không có quyền xem kỳ kế toán');
    }
    const manager = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: {
        isActive: true,
        role: { select: { name: true } },
        staffProfile: { select: { branchId: true } },
        managedBranch: {
          select: { id: true, code: true, name: true, managerId: true },
        },
      },
    });
    if (
      !manager?.isActive ||
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

  private async getPeriod(branchId: number, periodStart: Date) {
    return this.prisma.monthlyClosePeriod.findUnique({
      where: { branchId_periodStart: { branchId, periodStart } },
      include: {
        closedBy: {
          select: { email: true, profile: { select: { fullName: true } } },
        },
        reopenedBy: {
          select: { email: true, profile: { select: { fullName: true } } },
        },
        events: {
          include: {
            actor: {
              select: {
                email: true,
                profile: { select: { fullName: true } },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
  }

  private actorName(
    actor: {
      email: string;
      profile: { fullName: string | null } | null;
    } | null,
  ) {
    return actor?.profile?.fullName || actor?.email || 'Hệ thống';
  }

  private serializePeriod(
    period: Awaited<ReturnType<MonthCloseService['getPeriod']>>,
  ) {
    if (!period) return null;
    return {
      id: period.id,
      status: period.status,
      version: period.version,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      snapshot: period.snapshot,
      closedAt: period.closedAt,
      closedByName: this.actorName(period.closedBy),
      closeNote: period.closeNote,
      reopenedAt: period.reopenedAt,
      reopenedByName: period.reopenedBy
        ? this.actorName(period.reopenedBy)
        : null,
      reopenReason: period.reopenReason,
      events: period.events.map((event) => ({
        id: event.id,
        type: event.type,
        version: event.version,
        reason: event.reason,
        createdAt: event.createdAt,
        actorName: this.actorName(event.actor),
      })),
    };
  }

  private async buildReadiness(branch: Branch, month: string) {
    const range = monthRange(month);
    const [
      report,
      openCashSessions,
      pendingExpenses,
      pendingCounts,
      draftReceipts,
      unfinishedOrders,
      payrollPeriod,
      activeStaff,
      cashDifferences,
    ] = await Promise.all([
      this.profitabilityService.getReport({
        branchId: branch.id,
        from: range.from,
        to: range.to,
      }),
      this.prisma.cashSession.count({
        where: {
          branchId: branch.id,
          businessDate: { gte: range.periodStart, lt: range.periodEnd },
          status: { not: 'APPROVED' },
        },
      }),
      this.prisma.branchExpense.count({
        where: {
          branchId: branch.id,
          incurredOn: { gte: range.periodStart, lt: range.periodEnd },
          status: { in: ['DRAFT', 'PENDING'] },
        },
      }),
      this.prisma.inventoryCount.count({
        where: {
          branchId: branch.id,
          countedAt: { gte: range.periodStart, lt: range.periodEnd },
          status: { in: ['DRAFT', 'PENDING'] },
        },
      }),
      this.prisma.stockReceipt.count({
        where: {
          branchId: branch.id,
          createdAt: { gte: range.periodStart, lt: range.periodEnd },
          status: 'DRAFT',
        },
      }),
      this.prisma.order.count({
        where: {
          branchId: branch.id,
          createdAt: { gte: range.periodStart, lt: range.periodEnd },
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
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
      this.prisma.staffProfile.count({
        where: { branchId: branch.id, user: { isActive: true } },
      }),
      this.prisma.cashSession.count({
        where: {
          branchId: branch.id,
          businessDate: { gte: range.periodStart, lt: range.periodEnd },
          status: 'APPROVED',
          difference: { not: 0 },
        },
      }),
    ]);

    const todayKey = vietnamDateFormatter.format(new Date());
    const periodEndKey = range.periodEnd.toISOString().slice(0, 10);
    const periodHasEnded = todayKey >= periodEndKey;
    const blockers: ReadinessItem[] = [];
    const addBlocker = (
      code: string,
      label: string,
      count: number,
      href: string | null,
    ) => {
      if (count > 0) blockers.push({ code, label, count, href });
    };
    addBlocker(
      'PERIOD_NOT_ENDED',
      'Tháng chưa kết thúc',
      periodHasEnded ? 0 : 1,
      null,
    );
    addBlocker(
      'CASH_SESSION_PENDING',
      'Sổ quỹ chưa được Admin duyệt',
      openCashSessions,
      '/admin/cash-reconciliation',
    );
    addBlocker(
      'EXPENSE_PENDING',
      'Khoản chi còn nháp hoặc chờ duyệt',
      pendingExpenses,
      '/admin/expenses',
    );
    addBlocker(
      'INVENTORY_COUNT_PENDING',
      'Phiếu kiểm kê chưa xử lý xong',
      pendingCounts,
      '/admin/inventory-counts',
    );
    addBlocker(
      'STOCK_RECEIPT_PENDING',
      'Phiếu nhập kho còn nháp',
      draftReceipts,
      '/admin/stock-in',
    );
    addBlocker(
      'ORDER_PENDING',
      'Đơn hàng trong tháng chưa kết thúc',
      unfinishedOrders,
      '/admin/orders',
    );
    addBlocker(
      'PAYROLL_PENDING',
      'Bảng lương tháng chưa chốt',
      activeStaff > 0 && (!payrollPeriod || payrollPeriod.status === 'DRAFT')
        ? 1
        : 0,
      '/admin/payroll',
    );
    addBlocker(
      'MISSING_INVENTORY_COST',
      'Dòng nguyên liệu của đơn đã bán chưa có giá vốn',
      report.dataQuality.zeroCostAllocations,
      '/admin/profitability',
    );
    addBlocker(
      'UNCONSUMED_INVENTORY',
      'Đơn đã thanh toán chưa ghi nhận trừ kho',
      report.dataQuality.paidOrdersWithoutConsumedInventory,
      '/admin/profitability',
    );

    const warnings: ReadinessItem[] = [];
    if (report.dataQuality.estimatedCostOrders > 0) {
      warnings.push({
        code: 'ESTIMATED_COST',
        label: 'Đơn cũ đang dùng giá vốn ước tính',
        count: report.dataQuality.estimatedCostOrders,
        href: '/admin/profitability',
      });
    }
    if (cashDifferences > 0) {
      warnings.push({
        code: 'CASH_DIFFERENCE',
        label: 'Sổ quỹ đã duyệt có chênh lệch tiền mặt',
        count: cashDifferences,
        href: '/admin/cash-reconciliation',
      });
    }

    return { range, report, blockers, warnings, periodHasEnded };
  }

  async getOverview(
    viewerId: number,
    viewerRole: string,
    query: MonthCloseQueryDto,
  ) {
    const branch = await this.resolveBranch(
      viewerId,
      viewerRole,
      query.branchId,
    );
    const readiness = await this.buildReadiness(branch, query.month);
    const period = await this.getPeriod(branch.id, readiness.range.periodStart);
    const status = period?.status ?? 'OPEN';
    return {
      month: query.month,
      branch: {
        id: branch.id,
        code: branch.code,
        name: branch.name,
      },
      periodStart: readiness.range.periodStart,
      periodEnd: readiness.range.periodEnd,
      periodHasEnded: readiness.periodHasEnded,
      status,
      canClose:
        viewerRole === 'ADMIN' &&
        status === 'OPEN' &&
        readiness.blockers.length === 0,
      permissions: {
        canClose: viewerRole === 'ADMIN',
        canReopen: viewerRole === 'ADMIN',
      },
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      liveReport: readiness.report,
      period: this.serializePeriod(period),
    };
  }

  async closeMonth(actorId: number, dto: CloseMonthDto) {
    const branch = await this.resolveBranch(actorId, 'ADMIN', dto.branchId);
    const readiness = await this.buildReadiness(branch, dto.month);
    const current = await this.getPeriod(
      branch.id,
      readiness.range.periodStart,
    );
    if (current?.status === 'CLOSED') {
      throw new ConflictException('Kỳ này đã được chốt trước đó');
    }
    if (readiness.blockers.length) {
      throw new BadRequestException({
        message: 'Chưa thể chốt sổ vì vẫn còn dữ liệu cần xử lý',
        blockers: readiness.blockers,
      });
    }

    const closedAt = new Date();
    const nextVersion = (current?.version ?? 0) + 1;
    const closeNote = dto.note?.trim() || null;
    const snapshot = jsonSnapshot({
      schemaVersion: 1,
      month: dto.month,
      version: nextVersion,
      closedAt,
      branch: { id: branch.id, code: branch.code, name: branch.name },
      report: readiness.report,
      warnings: readiness.warnings,
    });

    const closed = await this.prisma.$transaction(async (tx) => {
      const closeData = {
        status: 'CLOSED' as const,
        version: nextVersion,
        snapshot,
        closedById: actorId,
        closedAt,
        closeNote,
        reopenedById: null,
        reopenedAt: null,
        reopenReason: null,
      };
      let period: Prisma.MonthlyClosePeriodGetPayload<object>;
      if (current) {
        const claimed = await tx.monthlyClosePeriod.updateMany({
          where: {
            id: current.id,
            status: 'OPEN',
            version: current.version,
          },
          data: closeData,
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'Kỳ vừa được chốt ở phiên làm việc khác, vui lòng tải lại',
          );
        }
        period = await tx.monthlyClosePeriod.findUniqueOrThrow({
          where: { id: current.id },
        });
      } else {
        period = await tx.monthlyClosePeriod.create({
          data: {
            branchId: branch.id,
            periodStart: readiness.range.periodStart,
            periodEnd: readiness.range.periodEnd,
            ...closeData,
          },
        });
      }
      await tx.monthlyCloseEvent.create({
        data: {
          periodId: period.id,
          type: 'CLOSED',
          version: nextVersion,
          actorId,
          reason: closeNote,
          snapshot,
        },
      });
      if (branch.managerId && branch.managerId !== actorId) {
        await tx.notification.create({
          data: {
            userId: branch.managerId,
            type: 'MONTH_CLOSE_CLOSED',
            title: 'Kỳ kế toán đã được chốt',
            message: `${branch.code} · tháng ${dto.month} đã được Admin chốt ở phiên bản ${nextVersion}.`,
          },
        });
      }
      return period;
    });

    await writeAuditLog(this.prisma, {
      actorId,
      branchId: branch.id,
      module: 'MONTH_CLOSE',
      action: 'CLOSE_MONTH',
      entityType: 'MonthlyClosePeriod',
      entityId: closed.id,
      description: `Chốt sổ ${branch.code} tháng ${dto.month}, phiên bản ${nextVersion}`,
      afterData: {
        status: closed.status,
        version: closed.version,
        closedAt,
        summary: readiness.report.summary,
      },
      metadata: { closeNote },
    });
    return {
      id: closed.id,
      status: closed.status,
      version: closed.version,
      closedAt,
    };
  }

  async reopenMonth(actorId: number, dto: ReopenMonthDto) {
    const branch = await this.resolveBranch(actorId, 'ADMIN', dto.branchId);
    const range = monthRange(dto.month);
    const current = await this.getPeriod(branch.id, range.periodStart);
    if (!current || current.status !== 'CLOSED') {
      throw new BadRequestException('Kỳ này chưa được chốt hoặc đã mở lại');
    }
    const reason = dto.reason.trim();
    const reopenedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.monthlyClosePeriod.updateMany({
        where: { id: current.id, status: 'CLOSED' },
        data: {
          status: 'OPEN',
          reopenedById: actorId,
          reopenedAt,
          reopenReason: reason,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'Trạng thái kỳ vừa thay đổi, vui lòng tải lại',
        );
      }
      await tx.monthlyCloseEvent.create({
        data: {
          periodId: current.id,
          type: 'REOPENED',
          version: current.version,
          actorId,
          reason,
          snapshot: current.snapshot ?? undefined,
        },
      });
      if (branch.managerId && branch.managerId !== actorId) {
        await tx.notification.create({
          data: {
            userId: branch.managerId,
            type: 'MONTH_CLOSE_REOPENED',
            title: 'Kỳ kế toán đã được mở lại',
            message: `${branch.code} · tháng ${dto.month} được mở lại để điều chỉnh: ${reason}`,
          },
        });
      }
    });

    await writeAuditLog(this.prisma, {
      actorId,
      branchId: branch.id,
      module: 'MONTH_CLOSE',
      action: 'REOPEN_MONTH',
      entityType: 'MonthlyClosePeriod',
      entityId: current.id,
      description: `Mở lại sổ ${branch.code} tháng ${dto.month}: ${reason}`,
      beforeData: { status: 'CLOSED', version: current.version },
      afterData: { status: 'OPEN', reopenedAt, reopenReason: reason },
    });
    return { id: current.id, status: 'OPEN', version: current.version };
  }
}
