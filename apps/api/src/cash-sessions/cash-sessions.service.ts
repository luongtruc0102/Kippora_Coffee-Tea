import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { CashSessionStatus } from '../../generated/prisma/enums';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { PrismaService } from '../prisma/prisma.service';
import { assertAccountingMonthOpen } from '../month-close/month-close-lock.util';
import {
  ApproveCashSessionDto,
  CloseCashSessionDto,
  ReopenCashSessionDto,
} from './dto/close-cash-session.dto';
import { ListCashSessionsDto } from './dto/list-cash-sessions.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

const personSelect = {
  id: true,
  email: true,
  ...personProfileSelect,
} satisfies Prisma.UserSelect;

const cashSessionInclude = {
  branch: { select: { id: true, code: true, name: true, isActive: true } },
  openedBy: { select: personSelect },
  closedBy: { select: personSelect },
  approvedBy: { select: personSelect },
  reopenedBy: { select: personSelect },
  events: {
    include: { actor: { select: personSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CashSessionInclude;

type DatabaseClient = PrismaService | Prisma.TransactionClient;

function vietnamDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function businessDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function paymentRange(value: string) {
  const start = new Date(`${value}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

function number(value: { toString(): string } | number | null | undefined) {
  return value === null || value === undefined
    ? null
    : Number(value.toString());
}

@Injectable()
export class CashSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async scope(
    viewerId: number,
    viewerRole: string,
    requestedBranchId?: number,
  ) {
    if (viewerRole === 'ADMIN') {
      const branches = await this.prisma.storeBranch.findMany({
        select: { id: true, code: true, name: true, isActive: true },
        orderBy: { code: 'asc' },
      });
      if (
        requestedBranchId &&
        !branches.some((branch) => branch.id === requestedBranchId)
      ) {
        throw new NotFoundException('Không tìm thấy sổ quỹ');
      }
      return { branchId: requestedBranchId, branches };
    }

    const manager = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: {
        isActive: true,
        role: { select: { name: true } },
        staffProfile: { select: { branchId: true } },
        managedBranch: {
          select: { id: true, code: true, name: true, isActive: true },
        },
      },
    });
    const managedBranch = manager?.managedBranch;
    if (
      !manager?.isActive ||
      manager.role.name !== 'BRANCH_MANAGER' ||
      !managedBranch ||
      manager.staffProfile?.branchId !== managedBranch.id
    ) {
      throw new ForbiddenException(
        'Tài khoản chưa được phân công quản lý chi nhánh',
      );
    }
    if (requestedBranchId && requestedBranchId !== managedBranch.id) {
      throw new NotFoundException('Không tìm thấy sổ quỹ');
    }
    return {
      branchId: managedBranch.id,
      branches: [managedBranch],
    };
  }

  private async load(id: number) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id },
      include: cashSessionInclude,
    });
    if (!session) throw new NotFoundException('Không tìm thấy sổ quỹ');
    return session;
  }

  private async loadScoped(viewerId: number, viewerRole: string, id: number) {
    const session = await this.load(id);
    const scope = await this.scope(viewerId, viewerRole, session.branchId);
    if (scope.branchId && scope.branchId !== session.branchId) {
      throw new NotFoundException('Không tìm thấy sổ quỹ');
    }
    return session;
  }

  private async calculate(
    client: DatabaseClient,
    branchId: number,
    dateKey: string,
    openingFloat: number,
  ) {
    const { start, end } = paymentRange(dateKey);
    const date = businessDate(dateKey);
    const nextDate = new Date(date.getTime() + 86_400_000);
    const [payments, refunds, cashExpenses, pendingCashExpenses] =
      await Promise.all([
        client.payment.groupBy({
          by: ['method'],
          where: {
            // REFUNDED vẫn giữ doanh thu gốc tại ngày thu; khoản trả lại được trừ theo ngày processedAt.
            status: { in: ['PAID', 'REFUNDED'] },
            paidAt: { gte: start, lt: end },
            order: { branchId },
          },
          _sum: { amount: true },
        }),
        client.paymentRefund.groupBy({
          by: ['method'],
          where: { branchId, processedAt: { gte: start, lt: end } },
          _sum: { amount: true },
        }),
        client.branchExpense.aggregate({
          where: {
            branchId,
            paymentMethod: 'CASH',
            status: 'APPROVED',
            incurredOn: { gte: date, lt: nextDate },
          },
          _sum: { amount: true },
        }),
        client.branchExpense.count({
          where: {
            branchId,
            paymentMethod: 'CASH',
            status: 'PENDING',
            incurredOn: { gte: date, lt: nextDate },
          },
        }),
      ]);
    const cashSalesAmount = Number(
      payments.find((item) => item.method === 'COD')?._sum.amount ?? 0,
    );
    const bankSalesAmount = Number(
      payments.find((item) => item.method === 'BANK_TRANSFER')?._sum.amount ??
        0,
    );
    const cashExpenseAmount = Number(cashExpenses._sum.amount ?? 0);
    const cashRefundAmount = Number(
      refunds.find((item) => item.method === 'CASH')?._sum.amount ?? 0,
    );
    const bankRefundAmount = Number(
      refunds.find((item) => item.method === 'BANK_TRANSFER')?._sum.amount ?? 0,
    );
    return {
      cashSalesAmount,
      bankSalesAmount,
      cashExpenseAmount,
      cashRefundAmount,
      bankRefundAmount,
      expectedCash:
        openingFloat + cashSalesAmount - cashExpenseAmount - cashRefundAmount,
      pendingCashExpenses,
    };
  }

  private serialize(
    session: Awaited<ReturnType<CashSessionsService['load']>>,
    live?: Awaited<ReturnType<CashSessionsService['calculate']>>,
  ) {
    const financial = live ?? {
      cashSalesAmount: Number(session.cashSalesAmount),
      bankSalesAmount: Number(session.bankSalesAmount),
      cashExpenseAmount: Number(session.cashExpenseAmount),
      cashRefundAmount: Number(session.cashRefundAmount),
      bankRefundAmount: Number(session.bankRefundAmount),
      expectedCash: Number(session.expectedCash),
      pendingCashExpenses: 0,
    };
    return {
      ...session,
      openingFloat: Number(session.openingFloat),
      ...financial,
      actualCash: number(session.actualCash),
      difference: number(session.difference),
      openedBy: flattenPersonProfile(session.openedBy),
      closedBy: session.closedBy
        ? flattenPersonProfile(session.closedBy)
        : null,
      approvedBy: session.approvedBy
        ? flattenPersonProfile(session.approvedBy)
        : null,
      reopenedBy: session.reopenedBy
        ? flattenPersonProfile(session.reopenedBy)
        : null,
      events: session.events.map((event) => ({
        ...event,
        actor: event.actor ? flattenPersonProfile(event.actor) : null,
      })),
    };
  }

  async findAll(
    viewerId: number,
    viewerRole: string,
    query: ListCashSessionsDto,
  ) {
    const scope = await this.scope(viewerId, viewerRole, query.branchId);
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException(
        'Ngày bắt đầu không được nằm sau ngày kết thúc',
      );
    }
    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.from) dateFilter.gte = businessDate(query.from);
    if (query.to) {
      dateFilter.lt = new Date(businessDate(query.to).getTime() + 86_400_000);
    }
    const sessions = await this.prisma.cashSession.findMany({
      where: {
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(Object.keys(dateFilter).length ? { businessDate: dateFilter } : {}),
      },
      include: cashSessionInclude,
      orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
    });
    const rows = await Promise.all(
      sessions.map(async (session) => {
        const live =
          session.status === CashSessionStatus.OPEN
            ? await this.calculate(
                this.prisma,
                session.branchId,
                session.businessDate.toISOString().slice(0, 10),
                Number(session.openingFloat),
              )
            : undefined;
        return this.serialize(session, live);
      }),
    );
    return {
      sessions: rows,
      branches: scope.branches,
      scopedBranchId: scope.branchId ?? null,
      today: vietnamDateKey(),
      summary: {
        total: rows.length,
        open: rows.filter((item) => item.status === 'OPEN').length,
        pending: rows.filter((item) => item.status === 'PENDING_REVIEW').length,
        approved: rows.filter((item) => item.status === 'APPROVED').length,
        totalDifference: rows.reduce(
          (sum, item) => sum + (item.difference ?? 0),
          0,
        ),
      },
    };
  }

  async findOne(viewerId: number, viewerRole: string, id: number) {
    const session = await this.loadScoped(viewerId, viewerRole, id);
    const live = await this.calculate(
      this.prisma,
      session.branchId,
      session.businessDate.toISOString().slice(0, 10),
      Number(session.openingFloat),
    );
    return this.serialize(session, {
      ...live,
      ...(session.status === CashSessionStatus.OPEN
        ? {}
        : {
            cashSalesAmount: Number(session.cashSalesAmount),
            bankSalesAmount: Number(session.bankSalesAmount),
            cashExpenseAmount: Number(session.cashExpenseAmount),
            cashRefundAmount: Number(session.cashRefundAmount),
            bankRefundAmount: Number(session.bankRefundAmount),
            expectedCash: Number(session.expectedCash),
          }),
    });
  }

  async open(viewerId: number, viewerRole: string, dto: OpenCashSessionDto) {
    const scope = await this.scope(viewerId, viewerRole, dto.branchId);
    const branch = scope.branches.find((item) => item.id === dto.branchId);
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');
    if (!branch.isActive) {
      throw new BadRequestException('Không thể mở quỹ cho chi nhánh bị khóa');
    }
    const dateKey = vietnamDateKey();
    const existing = await this.prisma.cashSession.findUnique({
      where: {
        branchId_businessDate: {
          branchId: branch.id,
          businessDate: businessDate(dateKey),
        },
      },
    });
    if (existing) {
      throw new ConflictException('Chi nhánh đã có sổ quỹ cho hôm nay');
    }
    const financial = await this.calculate(
      this.prisma,
      branch.id,
      dateKey,
      dto.openingFloat,
    );
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashSession.create({
        data: {
          code: `Q-${dateKey.replaceAll('-', '')}-${branch.code}`,
          branchId: branch.id,
          businessDate: businessDate(dateKey),
          openingFloat: dto.openingFloat,
          openingNote: dto.note?.trim() || null,
          openedById: viewerId,
          cashSalesAmount: financial.cashSalesAmount,
          bankSalesAmount: financial.bankSalesAmount,
          cashExpenseAmount: financial.cashExpenseAmount,
          cashRefundAmount: financial.cashRefundAmount,
          bankRefundAmount: financial.bankRefundAmount,
          expectedCash: financial.expectedCash,
        },
      });
      await tx.cashSessionEvent.create({
        data: {
          cashSessionId: created.id,
          actorId: viewerId,
          type: 'OPENED',
          afterData: {
            openingFloat: dto.openingFloat,
            expectedCash: financial.expectedCash,
          },
          reason: dto.note?.trim() || null,
        },
      });
      return tx.cashSession.findUniqueOrThrow({
        where: { id: created.id },
        include: cashSessionInclude,
      });
    });
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: branch.id,
      module: 'CASH_RECONCILIATION',
      action: 'OPEN_CASH_SESSION',
      entityType: 'CashSession',
      entityId: session.id,
      description: `Mở sổ quỹ ${session.code} với ${dto.openingFloat.toLocaleString('vi-VN')} đ`,
      afterData: session,
    });
    return this.serialize(session, financial);
  }

  async close(
    viewerId: number,
    viewerRole: string,
    id: number,
    dto: CloseCashSessionDto,
  ) {
    const current = await this.loadScoped(viewerId, viewerRole, id);
    if (current.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('Chỉ sổ quỹ đang mở mới được kiểm đếm');
    }
    const financial = await this.calculate(
      this.prisma,
      current.branchId,
      current.businessDate.toISOString().slice(0, 10),
      Number(current.openingFloat),
    );
    const difference = dto.actualCash - financial.expectedCash;
    const note = dto.note?.trim() || null;
    if (Math.abs(difference) >= 0.01 && !note) {
      throw new BadRequestException(
        'Quỹ đang chênh lệch, vui lòng nhập nội dung giải trình',
      );
    }
    const closed = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.cashSession.updateMany({
        where: { id, status: CashSessionStatus.OPEN },
        data: {
          status: CashSessionStatus.PENDING_REVIEW,
          cashSalesAmount: financial.cashSalesAmount,
          bankSalesAmount: financial.bankSalesAmount,
          cashExpenseAmount: financial.cashExpenseAmount,
          cashRefundAmount: financial.cashRefundAmount,
          bankRefundAmount: financial.bankRefundAmount,
          expectedCash: financial.expectedCash,
          actualCash: dto.actualCash,
          difference,
          closingNote: note,
          closedById: viewerId,
          closedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Sổ quỹ vừa thay đổi, vui lòng tải lại');
      }
      await tx.cashSessionEvent.create({
        data: {
          cashSessionId: id,
          actorId: viewerId,
          type: 'CLOSED',
          reason: note,
          beforeData: { status: current.status },
          afterData: { ...financial, actualCash: dto.actualCash, difference },
        },
      });
      const admins = await tx.user.findMany({
        where: { isActive: true, role: { name: 'ADMIN' } },
        select: { id: true },
      });
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: 'CASH_SESSION_PENDING',
            title: 'Có sổ quỹ chờ duyệt',
            message: `${current.branch.code} đã đóng ${current.code}; chênh lệch ${difference.toLocaleString('vi-VN')} đ.`,
          })),
        });
      }
      return tx.cashSession.findUniqueOrThrow({
        where: { id },
        include: cashSessionInclude,
      });
    });
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: current.branchId,
      module: 'CASH_RECONCILIATION',
      action: 'CLOSE_CASH_SESSION',
      entityType: 'CashSession',
      entityId: id,
      description: `Kiểm đếm và gửi duyệt sổ quỹ ${current.code}`,
      beforeData: current,
      afterData: closed,
    });
    return this.serialize(closed);
  }

  async approve(viewerId: number, id: number, dto: ApproveCashSessionDto) {
    const current = await this.load(id);
    if (current.status !== CashSessionStatus.PENDING_REVIEW) {
      throw new BadRequestException('Sổ quỹ không còn chờ duyệt');
    }
    const financial = await this.calculate(
      this.prisma,
      current.branchId,
      current.businessDate.toISOString().slice(0, 10),
      Number(current.openingFloat),
    );
    if (financial.pendingCashExpenses > 0) {
      throw new BadRequestException(
        `Còn ${financial.pendingCashExpenses} khoản chi tiền mặt đang chờ duyệt`,
      );
    }
    const figuresChanged =
      Math.abs(financial.cashSalesAmount - Number(current.cashSalesAmount)) >=
        0.01 ||
      Math.abs(financial.bankSalesAmount - Number(current.bankSalesAmount)) >=
        0.01 ||
      Math.abs(
        financial.cashExpenseAmount - Number(current.cashExpenseAmount),
      ) >= 0.01 ||
      Math.abs(financial.cashRefundAmount - Number(current.cashRefundAmount)) >=
        0.01 ||
      Math.abs(financial.bankRefundAmount - Number(current.bankRefundAmount)) >=
        0.01 ||
      Math.abs(financial.expectedCash - Number(current.expectedCash)) >= 0.01;
    if (figuresChanged) {
      throw new BadRequestException(
        'Số liệu thu hoặc chi đã thay đổi sau khi đóng sổ. Vui lòng mở lại sổ quỹ để kiểm đếm lại',
      );
    }
    const actualCash = Number(current.actualCash ?? 0);
    const difference = actualCash - financial.expectedCash;
    const approved = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.cashSession.updateMany({
        where: { id, status: CashSessionStatus.PENDING_REVIEW },
        data: {
          status: CashSessionStatus.APPROVED,
          cashSalesAmount: financial.cashSalesAmount,
          bankSalesAmount: financial.bankSalesAmount,
          cashExpenseAmount: financial.cashExpenseAmount,
          cashRefundAmount: financial.cashRefundAmount,
          bankRefundAmount: financial.bankRefundAmount,
          expectedCash: financial.expectedCash,
          difference,
          approvedById: viewerId,
          approvedAt: new Date(),
          reviewNote: dto.note?.trim() || null,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Sổ quỹ vừa được xử lý, vui lòng tải lại');
      }
      await tx.cashSessionEvent.create({
        data: {
          cashSessionId: id,
          actorId: viewerId,
          type: 'APPROVED',
          reason: dto.note?.trim() || null,
          beforeData: { status: current.status },
          afterData: { ...financial, actualCash, difference },
        },
      });
      await tx.notification.create({
        data: {
          userId: current.openedById,
          type: 'CASH_SESSION_APPROVED',
          title: 'Sổ quỹ đã được duyệt',
          message: `${current.code} đã được Admin khóa sổ.`,
        },
      });
      return tx.cashSession.findUniqueOrThrow({
        where: { id },
        include: cashSessionInclude,
      });
    });
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: current.branchId,
      module: 'CASH_RECONCILIATION',
      action: 'APPROVE_CASH_SESSION',
      entityType: 'CashSession',
      entityId: id,
      description: `Duyệt và khóa sổ quỹ ${current.code}`,
      beforeData: current,
      afterData: approved,
    });
    return this.serialize(approved);
  }

  async reopen(viewerId: number, id: number, dto: ReopenCashSessionDto) {
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Vui lòng nhập lý do mở lại');
    const current = await this.load(id);
    if (current.status === CashSessionStatus.OPEN) {
      throw new BadRequestException('Sổ quỹ đang mở');
    }
    await assertAccountingMonthOpen(
      this.prisma,
      current.branchId,
      current.businessDate,
      'mở lại sổ quỹ',
    );
    const live = await this.calculate(
      this.prisma,
      current.branchId,
      current.businessDate.toISOString().slice(0, 10),
      Number(current.openingFloat),
    );
    const reopened = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.cashSession.updateMany({
        where: { id, status: { not: CashSessionStatus.OPEN } },
        data: {
          status: CashSessionStatus.OPEN,
          cashSalesAmount: live.cashSalesAmount,
          bankSalesAmount: live.bankSalesAmount,
          cashExpenseAmount: live.cashExpenseAmount,
          cashRefundAmount: live.cashRefundAmount,
          bankRefundAmount: live.bankRefundAmount,
          expectedCash: live.expectedCash,
          actualCash: null,
          difference: null,
          closingNote: null,
          closedById: null,
          closedAt: null,
          approvedById: null,
          approvedAt: null,
          reviewNote: null,
          reopenedById: viewerId,
          reopenedAt: new Date(),
          reopenReason: reason,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Sổ quỹ vừa thay đổi, vui lòng tải lại');
      }
      await tx.cashSessionEvent.create({
        data: {
          cashSessionId: id,
          actorId: viewerId,
          type: 'REOPENED',
          reason,
          beforeData: {
            status: current.status,
            actualCash: current.actualCash,
            difference: current.difference,
          },
          afterData: { status: CashSessionStatus.OPEN },
        },
      });
      await tx.notification.create({
        data: {
          userId: current.openedById,
          type: 'CASH_SESSION_REOPENED',
          title: 'Sổ quỹ được mở lại',
          message: `${current.code} cần kiểm đếm lại: ${reason}`,
        },
      });
      return tx.cashSession.findUniqueOrThrow({
        where: { id },
        include: cashSessionInclude,
      });
    });
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: current.branchId,
      module: 'CASH_RECONCILIATION',
      action: 'REOPEN_CASH_SESSION',
      entityType: 'CashSession',
      entityId: id,
      description: `Mở lại sổ quỹ ${current.code}: ${reason}`,
      beforeData: current,
      afterData: reopened,
    });
    return this.serialize(reopened, live);
  }
}
