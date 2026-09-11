import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import { ExpenseCategory, ExpenseStatus } from '../../generated/prisma/enums';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';
import { ReviewExpenseDto } from './dto/review-expense.dto';

const expenseInclude = {
  branch: {
    select: { id: true, code: true, name: true, isActive: true },
  },
  createdBy: {
    select: { id: true, email: true, ...personProfileSelect },
  },
  reviewedBy: {
    select: { id: true, email: true, ...personProfileSelect },
  },
} satisfies Prisma.BranchExpenseInclude;

const categoryLabels: Record<ExpenseCategory, string> = {
  RENT: 'Tiền thuê mặt bằng',
  UTILITIES: 'Điện, nước và dịch vụ',
  MAINTENANCE: 'Bảo trì và sửa chữa',
  MARKETING: 'Marketing',
  SUPPLIES: 'Vật tư vận hành',
  TRANSPORT: 'Vận chuyển',
  OTHER: 'Chi phí khác',
};

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize<
    T extends {
      amount: { toString(): string } | number;
      createdBy: Parameters<typeof flattenPersonProfile>[0];
      reviewedBy: Parameters<typeof flattenPersonProfile>[0] | null;
    },
  >(expense: T) {
    return {
      ...expense,
      amount: Number(expense.amount.toString()),
      createdBy: flattenPersonProfile(expense.createdBy),
      reviewedBy: expense.reviewedBy
        ? flattenPersonProfile(expense.reviewedBy)
        : null,
    };
  }

  private async resolveScope(
    viewerId: number,
    viewerRole: string,
    requestedBranchId?: number,
  ) {
    const branches = await this.prisma.storeBranch.findMany({
      select: { id: true, code: true, name: true, isActive: true },
      orderBy: { code: 'asc' },
    });

    if (viewerRole === 'ADMIN') {
      if (
        requestedBranchId &&
        !branches.some((branch) => branch.id === requestedBranchId)
      ) {
        throw new NotFoundException('Không tìm thấy chi nhánh');
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
      throw new NotFoundException('Không tìm thấy khoản chi');
    }
    return { branchId: managedBranch.id, branches: [managedBranch] };
  }

  private async load(id: number) {
    const expense = await this.prisma.branchExpense.findUnique({
      where: { id },
      include: expenseInclude,
    });
    if (!expense) throw new NotFoundException('Không tìm thấy khoản chi');
    return expense;
  }

  private async loadScoped(viewerId: number, viewerRole: string, id: number) {
    const expense = await this.load(id);
    const scope = await this.resolveScope(
      viewerId,
      viewerRole,
      expense.branchId,
    );
    if (scope.branchId && scope.branchId !== expense.branchId) {
      throw new NotFoundException('Không tìm thấy khoản chi');
    }
    return expense;
  }

  private incurredDate(value: string) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (value > today) {
      throw new BadRequestException(
        'Ngày phát sinh khoản chi không được nằm trong tương lai',
      );
    }
    return new Date(`${value}T00:00:00.000Z`);
  }

  private assertOwner(
    viewerId: number,
    viewerRole: string,
    expense: { createdById: number },
  ) {
    if (viewerRole !== 'ADMIN' && expense.createdById !== viewerId) {
      throw new ForbiddenException(
        'Chỉ người lập khoản chi hoặc Admin được thực hiện thao tác này',
      );
    }
  }

  private code(id: number, incurredOn: string) {
    return `CP-${incurredOn.slice(0, 7).replace('-', '')}-${String(id).padStart(5, '0')}`;
  }

  async findAll(viewerId: number, viewerRole: string, query: ListExpensesDto) {
    const scope = await this.resolveScope(viewerId, viewerRole, query.branchId);
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException(
        'Ngày bắt đầu không được nằm sau ngày kết thúc',
      );
    }

    const incurredOn: Prisma.DateTimeFilter = {};
    if (query.from) {
      incurredOn.gte = new Date(`${query.from}T00:00:00.000Z`);
    }
    if (query.to) {
      incurredOn.lt = new Date(
        new Date(`${query.to}T00:00:00.000Z`).getTime() + 86_400_000,
      );
    }
    const keyword = query.q?.trim();
    const where: Prisma.BranchExpenseWhereInput = {
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(Object.keys(incurredOn).length ? { incurredOn } : {}),
      ...(keyword
        ? {
            OR: [
              { code: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
              { note: { contains: keyword, mode: 'insensitive' } },
              {
                createdBy: {
                  profile: {
                    fullName: { contains: keyword, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const expenses = await this.prisma.branchExpense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ incurredOn: 'desc' }, { id: 'desc' }],
    });
    const approved = expenses.filter(
      (expense) => expense.status === ExpenseStatus.APPROVED,
    );
    const pending = expenses.filter(
      (expense) => expense.status === ExpenseStatus.PENDING,
    );
    const byCategory = Object.fromEntries(
      Object.values(ExpenseCategory).map((category) => [
        category,
        approved
          .filter((expense) => expense.category === category)
          .reduce((sum, expense) => sum + Number(expense.amount), 0),
      ]),
    );

    return {
      expenses: expenses.map((expense) => this.serialize(expense)),
      branches: scope.branches,
      scopedBranchId: scope.branchId ?? null,
      summary: {
        total: expenses.length,
        draft: expenses.filter(
          (expense) => expense.status === ExpenseStatus.DRAFT,
        ).length,
        pending: pending.length,
        pendingAmount: pending.reduce(
          (sum, expense) => sum + Number(expense.amount),
          0,
        ),
        approved: approved.length,
        approvedAmount: approved.reduce(
          (sum, expense) => sum + Number(expense.amount),
          0,
        ),
        rejected: expenses.filter(
          (expense) => expense.status === ExpenseStatus.REJECTED,
        ).length,
        byCategory,
      },
    };
  }

  async create(viewerId: number, viewerRole: string, dto: CreateExpenseDto) {
    const scope = await this.resolveScope(viewerId, viewerRole, dto.branchId);
    const branch = scope.branches.find((item) => item.id === dto.branchId);
    if (!branch || (scope.branchId && scope.branchId !== dto.branchId)) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }
    if (!branch.isActive) {
      throw new BadRequestException(
        'Không thể lập khoản chi cho chi nhánh đang bị khóa',
      );
    }
    const description = dto.description.trim();
    if (!description) {
      throw new BadRequestException('Vui lòng nhập nội dung khoản chi');
    }
    const incurredOn = this.incurredDate(dto.incurredOn);
    const created = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.branchExpense.create({
        data: {
          code: `TMP-${randomUUID().slice(0, 18)}`,
          branchId: dto.branchId,
          createdById: viewerId,
          category: dto.category,
          paymentMethod: dto.paymentMethod,
          amount: dto.amount,
          incurredOn,
          description,
          note: dto.note?.trim() || null,
        },
      });
      return tx.branchExpense.update({
        where: { id: draft.id },
        data: { code: this.code(draft.id, dto.incurredOn) },
        include: expenseInclude,
      });
    });

    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: created.branchId,
      module: 'EXPENSE',
      action: 'CREATE_EXPENSE',
      entityType: 'BranchExpense',
      entityId: created.id,
      description: `Lập khoản chi ${created.code}: ${created.description}`,
      afterData: created,
    });
    return this.serialize(created);
  }

  async update(
    viewerId: number,
    viewerRole: string,
    id: number,
    dto: UpdateExpenseDto,
  ) {
    const current = await this.loadScoped(viewerId, viewerRole, id);
    this.assertOwner(viewerId, viewerRole, current);
    if (
      current.status !== ExpenseStatus.DRAFT &&
      current.status !== ExpenseStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Chỉ khoản chi nháp hoặc bị từ chối mới được chỉnh sửa',
      );
    }
    if (dto.branchId !== current.branchId) {
      throw new BadRequestException(
        'Không thể đổi chi nhánh của khoản chi đã tạo',
      );
    }
    const description = dto.description.trim();
    if (!description) {
      throw new BadRequestException('Vui lòng nhập nội dung khoản chi');
    }
    const claimed = await this.prisma.branchExpense.updateMany({
      where: {
        id,
        status: { in: [ExpenseStatus.DRAFT, ExpenseStatus.REJECTED] },
      },
      data: {
        category: dto.category,
        paymentMethod: dto.paymentMethod,
        amount: dto.amount,
        incurredOn: this.incurredDate(dto.incurredOn),
        description,
        note: dto.note?.trim() || null,
        status: ExpenseStatus.DRAFT,
        submittedAt: null,
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Khoản chi vừa thay đổi trạng thái, vui lòng tải lại',
      );
    }
    const updated = await this.load(id);
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: updated.branchId,
      module: 'EXPENSE',
      action: 'UPDATE_EXPENSE',
      entityType: 'BranchExpense',
      entityId: updated.id,
      description: `Chỉnh sửa khoản chi ${updated.code}`,
      beforeData: current,
      afterData: updated,
    });
    return this.serialize(updated);
  }

  async submit(viewerId: number, viewerRole: string, id: number) {
    const current = await this.loadScoped(viewerId, viewerRole, id);
    this.assertOwner(viewerId, viewerRole, current);
    if (
      current.status !== ExpenseStatus.DRAFT &&
      current.status !== ExpenseStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Khoản chi không còn ở trạng thái có thể gửi duyệt',
      );
    }
    const submitted = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.branchExpense.updateMany({
        where: {
          id,
          status: { in: [ExpenseStatus.DRAFT, ExpenseStatus.REJECTED] },
        },
        data: {
          status: ExpenseStatus.PENDING,
          submittedAt: new Date(),
          reviewedById: null,
          reviewedAt: null,
          reviewNote: null,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'Khoản chi vừa thay đổi trạng thái, vui lòng tải lại',
        );
      }
      const admins = await tx.user.findMany({
        where: { isActive: true, role: { name: 'ADMIN' } },
        select: { id: true },
      });
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: 'EXPENSE_SUBMITTED',
            title: 'Có khoản chi chờ duyệt',
            message: `${current.branch.code} gửi ${current.code} trị giá ${Number(current.amount).toLocaleString('vi-VN')} đ.`,
          })),
        });
      }
      return tx.branchExpense.findUniqueOrThrow({
        where: { id },
        include: expenseInclude,
      });
    });

    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: submitted.branchId,
      module: 'EXPENSE',
      action: 'SUBMIT_EXPENSE',
      entityType: 'BranchExpense',
      entityId: submitted.id,
      description: `Gửi Admin duyệt khoản chi ${submitted.code}`,
      beforeData: { status: current.status },
      afterData: {
        status: submitted.status,
        submittedAt: submitted.submittedAt,
      },
    });
    return this.serialize(submitted);
  }

  async review(
    viewerId: number,
    viewerRole: string,
    id: number,
    dto: ReviewExpenseDto,
  ) {
    if (viewerRole !== 'ADMIN') {
      throw new ForbiddenException('Chỉ Admin được duyệt khoản chi');
    }
    const current = await this.load(id);
    if (current.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException('Khoản chi không còn chờ duyệt');
    }
    const reviewNote = dto.note?.trim() || null;
    if (dto.decision === 'REJECT' && !reviewNote) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }
    const nextStatus =
      dto.decision === 'APPROVE'
        ? ExpenseStatus.APPROVED
        : ExpenseStatus.REJECTED;
    const reviewed = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.branchExpense.updateMany({
        where: { id, status: ExpenseStatus.PENDING },
        data: {
          status: nextStatus,
          reviewedById: viewerId,
          reviewedAt: new Date(),
          reviewNote,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'Khoản chi vừa được xử lý, vui lòng tải lại',
        );
      }
      await tx.notification.create({
        data: {
          userId: current.createdById,
          type:
            nextStatus === ExpenseStatus.APPROVED
              ? 'EXPENSE_APPROVED'
              : 'EXPENSE_REJECTED',
          title:
            nextStatus === ExpenseStatus.APPROVED
              ? 'Khoản chi đã được duyệt'
              : 'Khoản chi cần chỉnh sửa',
          message:
            nextStatus === ExpenseStatus.APPROVED
              ? `${current.code} đã được tính vào báo cáo chi phí.`
              : `${current.code} bị từ chối: ${reviewNote}`,
        },
      });
      return tx.branchExpense.findUniqueOrThrow({
        where: { id },
        include: expenseInclude,
      });
    });

    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: reviewed.branchId,
      module: 'EXPENSE',
      action:
        nextStatus === ExpenseStatus.APPROVED
          ? 'APPROVE_EXPENSE'
          : 'REJECT_EXPENSE',
      entityType: 'BranchExpense',
      entityId: reviewed.id,
      description: `${
        nextStatus === ExpenseStatus.APPROVED ? 'Duyệt' : 'Từ chối'
      } khoản chi ${reviewed.code}`,
      beforeData: { status: current.status },
      afterData: {
        status: reviewed.status,
        category: categoryLabels[reviewed.category],
        amount: reviewed.amount,
        reviewNote: reviewed.reviewNote,
      },
    });
    return this.serialize(reviewed);
  }

  async cancel(viewerId: number, viewerRole: string, id: number) {
    const current = await this.loadScoped(viewerId, viewerRole, id);
    this.assertOwner(viewerId, viewerRole, current);
    if (
      current.status !== ExpenseStatus.DRAFT &&
      current.status !== ExpenseStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Chỉ khoản chi nháp hoặc bị từ chối mới được hủy',
      );
    }
    const claimed = await this.prisma.branchExpense.updateMany({
      where: {
        id,
        status: { in: [ExpenseStatus.DRAFT, ExpenseStatus.REJECTED] },
      },
      data: { status: ExpenseStatus.CANCELLED },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Khoản chi vừa thay đổi trạng thái, vui lòng tải lại',
      );
    }
    const cancelled = await this.load(id);
    await writeAuditLog(this.prisma, {
      actorId: viewerId,
      branchId: cancelled.branchId,
      module: 'EXPENSE',
      action: 'CANCEL_EXPENSE',
      entityType: 'BranchExpense',
      entityId: cancelled.id,
      description: `Hủy khoản chi ${cancelled.code}`,
      beforeData: { status: current.status },
      afterData: { status: cancelled.status },
    });
    return this.serialize(cancelled);
  }
}
