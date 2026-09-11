import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import {
  CreateInventoryCountDto,
  UpdateInventoryCountDto,
} from './dto/create-inventory-count.dto';
import { ListInventoryCountsDto } from './dto/list-inventory-counts.dto';
import { ReviewInventoryCountDto } from './dto/review-inventory-count.dto';
import { InventoryService } from './inventory.service';

const countInclude = {
  branch: true,
  createdBy: { select: { id: true, email: true, ...personProfileSelect } },
  reviewedBy: { select: { id: true, email: true, ...personProfileSelect } },
  items: {
    include: { ingredient: true },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.InventoryCountInclude;

@Injectable()
export class InventoryCountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  private number(value: { toString(): string } | number) {
    return Number(value.toString());
  }

  private roundQuantity(value: number) {
    return Math.round(value * 1000) / 1000;
  }

  private serializeCount<
    T extends {
      createdBy: Parameters<typeof flattenPersonProfile>[0];
      reviewedBy: Parameters<typeof flattenPersonProfile>[0] | null;
      items: Array<{
        expectedQuantity: { toString(): string } | number;
        countedQuantity: { toString(): string } | number;
        differenceQuantity: { toString(): string } | number;
      }>;
    },
  >(count: T) {
    return {
      ...count,
      createdBy: flattenPersonProfile(count.createdBy),
      reviewedBy: count.reviewedBy
        ? flattenPersonProfile(count.reviewedBy)
        : null,
      items: count.items.map((item) => ({
        ...item,
        expectedQuantity: this.number(item.expectedQuantity),
        countedQuantity: this.number(item.countedQuantity),
        differenceQuantity: this.number(item.differenceQuantity),
      })),
    };
  }

  async findAll(userId: number, role: string, query: ListInventoryCountsDto) {
    const branch = await this.inventoryService.getScopedBranch(
      userId,
      role,
      query.branchId,
    );
    const countedAt: Prisma.DateTimeFilter = {};
    if (query.from) countedAt.gte = new Date(`${query.from}T00:00:00+07:00`);
    if (query.to) {
      const end = new Date(`${query.to}T00:00:00+07:00`);
      end.setDate(end.getDate() + 1);
      countedAt.lt = end;
    }
    const keyword = query.q?.trim();
    const counts = await this.prisma.inventoryCount.findMany({
      where: {
        branchId: branch.id,
        ...(query.status ? { status: query.status } : {}),
        ...(Object.keys(countedAt).length ? { countedAt } : {}),
        ...(keyword
          ? {
              OR: [
                { code: { contains: keyword, mode: 'insensitive' } },
                { note: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: countInclude,
      orderBy: { createdAt: 'desc' },
    });
    const branches =
      role === 'ADMIN'
        ? await this.prisma.storeBranch.findMany({ orderBy: { code: 'asc' } })
        : [branch];
    const serialized = counts.map((count) => this.serializeCount(count));
    return {
      selectedBranch: branch,
      branches,
      counts: serialized,
      summary: {
        total: counts.length,
        draft: counts.filter((item) => item.status === 'DRAFT').length,
        pending: counts.filter((item) => item.status === 'PENDING').length,
        approved: counts.filter((item) => item.status === 'APPROVED').length,
        shortageItems: serialized.reduce(
          (sum, count) =>
            sum +
            count.items.filter(
              (item) => this.number(item.differenceQuantity) < 0,
            ).length,
          0,
        ),
      },
    };
  }

  async findOne(userId: number, role: string, id: number) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      include: countInclude,
    });
    if (!count) throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
    await this.inventoryService.getScopedBranch(userId, role, count.branchId);
    return this.serializeCount(count);
  }

  async create(userId: number, role: string, dto: CreateInventoryCountDto) {
    await this.inventoryService.getScopedBranch(userId, role, dto.branchId);
    const items = await this.prepareItems(dto);
    const count = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryCount.create({
        data: {
          code: `TMP-${randomUUID().slice(0, 18)}`,
          branchId: dto.branchId,
          createdById: userId,
          countedAt: new Date(dto.countedAt),
          note: dto.note?.trim() || null,
          items: { create: items },
        },
      });
      return tx.inventoryCount.update({
        where: { id: created.id },
        data: { code: this.createCode(created.id, created.countedAt) },
        include: countInclude,
      });
    });
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: count.branchId,
      module: 'INVENTORY',
      action: 'CREATE_INVENTORY_COUNT',
      entityType: 'InventoryCount',
      entityId: count.id,
      description: `Lập phiếu kiểm kê ${count.code}`,
      afterData: {
        code: count.code,
        status: count.status,
        countedAt: count.countedAt,
        note: count.note,
        items: count.items,
      },
    });
    return this.serializeCount(count);
  }

  async update(
    userId: number,
    role: string,
    id: number,
    dto: UpdateInventoryCountDto,
  ) {
    const current = await this.findOne(userId, role, id);
    if (current.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ phiếu nháp mới được chỉnh sửa');
    }
    if (current.branchId !== dto.branchId) {
      throw new BadRequestException('Không thể đổi chi nhánh của phiếu đã tạo');
    }
    const items = await this.prepareItems(dto);
    const count = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.inventoryCount.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          countedAt: new Date(dto.countedAt),
          note: dto.note?.trim() || null,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Phiếu vừa thay đổi trạng thái, vui lòng tải lại',
        );
      }
      await tx.inventoryCountItem.deleteMany({
        where: { inventoryCountId: id },
      });
      await tx.inventoryCountItem.createMany({
        data: items.map((item) => ({ inventoryCountId: id, ...item })),
      });
      return tx.inventoryCount.findUniqueOrThrow({
        where: { id },
        include: countInclude,
      });
    });
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: count.branchId,
      module: 'INVENTORY',
      action: 'UPDATE_INVENTORY_COUNT',
      entityType: 'InventoryCount',
      entityId: count.id,
      description: `Cập nhật phiếu kiểm kê ${count.code}`,
      beforeData: {
        countedAt: current.countedAt,
        note: current.note,
        items: current.items,
      },
      afterData: {
        countedAt: count.countedAt,
        note: count.note,
        items: count.items,
      },
    });
    return this.serializeCount(count);
  }

  async submit(userId: number, role: string, id: number) {
    const current = await this.findOne(userId, role, id);
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        'Phiếu kiểm kê không còn ở trạng thái nháp',
      );
    }
    const stocks = await this.prisma.inventoryStock.findMany({
      where: {
        branchId: current.branchId,
        ingredientId: { in: current.items.map((item) => item.ingredientId) },
      },
    });
    const stockByIngredient = new Map(
      stocks.map((stock) => [stock.ingredientId, this.number(stock.quantity)]),
    );
    const stale = current.items.some(
      (item) =>
        Math.abs(
          (stockByIngredient.get(item.ingredientId) ?? 0) -
            this.number(item.expectedQuantity),
        ) > 0.0005,
    );
    if (stale) {
      throw new BadRequestException(
        'Tồn kho đã thay đổi sau lần lưu gần nhất. Vui lòng mở sửa, kiểm tra lại số đếm rồi lưu lại.',
      );
    }
    const submittedAt = new Date();
    const count = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.inventoryCount.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'PENDING', submittedAt },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Phiếu vừa thay đổi trạng thái, vui lòng tải lại',
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
            type: 'INVENTORY_COUNT_SUBMITTED',
            title: 'Có phiếu kiểm kê chờ duyệt',
            message: `${current.branch.code} vừa gửi phiếu ${current.code}.`,
          })),
        });
      }
      return tx.inventoryCount.findUniqueOrThrow({
        where: { id },
        include: countInclude,
      });
    });
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: count.branchId,
      module: 'INVENTORY',
      action: 'SUBMIT_INVENTORY_COUNT',
      entityType: 'InventoryCount',
      entityId: count.id,
      description: `Gửi duyệt phiếu kiểm kê ${count.code}`,
      beforeData: { status: 'DRAFT' },
      afterData: { status: 'PENDING', submittedAt },
    });
    return this.serializeCount(count);
  }

  async approve(userId: number, id: number, dto: ReviewInventoryCountDto) {
    const current = await this.findOne(userId, 'ADMIN', id);
    if (current.status !== 'PENDING') {
      throw new BadRequestException('Chỉ phiếu đang chờ mới được duyệt');
    }
    const reviewedAt = new Date();
    const count = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.inventoryCount.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          reviewedById: userId,
          reviewedAt,
          reviewNote: dto.reviewNote?.trim() || null,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('Phiếu vừa được xử lý, vui lòng tải lại');
      }
      const approved = await tx.inventoryCount.findUniqueOrThrow({
        where: { id },
        include: countInclude,
      });
      for (const item of approved.items) {
        const difference = this.number(item.differenceQuantity);
        if (Math.abs(difference) <= 0.0005) continue;
        const currentStock = await tx.inventoryStock.findUnique({
          where: {
            branchId_ingredientId: {
              branchId: approved.branchId,
              ingredientId: item.ingredientId,
            },
          },
        });
        let stock: Pick<
          Prisma.InventoryStockGetPayload<object>,
          'id' | 'quantity' | 'reservedQuantity'
        >;
        if (difference < 0) {
          if (!currentStock) {
            throw new BadRequestException(
              `${item.ingredient.name} không còn tồn để áp phần thiếu hụt. Vui lòng từ chối phiếu và kiểm kê lại.`,
            );
          }
          const reservedQuantity = this.number(currentStock.reservedQuantity);
          const claimed = await tx.inventoryStock.updateMany({
            where: {
              id: currentStock.id,
              reservedQuantity: currentStock.reservedQuantity,
              quantity: { gte: reservedQuantity + Math.abs(difference) },
            },
            data: { quantity: { increment: difference } },
          });
          if (claimed.count !== 1) {
            throw new BadRequestException(
              `${item.ingredient.name} vừa phát sinh biến động hoặc đang được giữ cho đơn hàng. Vui lòng từ chối phiếu và kiểm kê lại.`,
            );
          }
          stock = await tx.inventoryStock.findUniqueOrThrow({
            where: { id: currentStock.id },
          });
        } else {
          stock = await tx.inventoryStock.upsert({
            where: {
              branchId_ingredientId: {
                branchId: approved.branchId,
                ingredientId: item.ingredientId,
              },
            },
            create: {
              branchId: approved.branchId,
              ingredientId: item.ingredientId,
              quantity: this.roundQuantity(difference),
            },
            update: { quantity: { increment: difference } },
          });
        }
        const lotChanges = await this.inventoryService.applyInventoryCountToLots(
          tx,
          approved.branchId,
          item.ingredientId,
          approved.id,
          difference,
        );
        await tx.inventoryMovement.createMany({
          data: lotChanges.map((change) => ({
            branchId: approved.branchId,
            ingredientId: item.ingredientId,
            lotId: change.lotId,
            inventoryCountId: approved.id,
            actorId: userId,
            type: 'ADJUST' as const,
            quantityDelta: change.quantityDelta,
            reservedDelta: 0,
            quantityAfter: stock.quantity,
            reservedAfter: stock.reservedQuantity,
            note: `Kiểm kê ${approved.code}: ${item.reason ?? 'OTHER'}${item.note ? ` - ${item.note}` : ''}`,
          })),
        });
        await this.inventoryService.syncLowStockNotification(tx, stock.id);
      }
      await tx.notification.create({
        data: {
          userId: approved.createdById,
          type: 'INVENTORY_COUNT_APPROVED',
          title: 'Phiếu kiểm kê đã được duyệt',
          message: `${approved.code} đã được duyệt và chênh lệch đã cập nhật vào tồn kho.`,
        },
      });
      return tx.inventoryCount.findUniqueOrThrow({
        where: { id },
        include: countInclude,
      });
    });
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: count.branchId,
      module: 'INVENTORY',
      action: 'APPROVE_INVENTORY_COUNT',
      entityType: 'InventoryCount',
      entityId: count.id,
      description: `Duyệt phiếu kiểm kê ${count.code} và cập nhật tồn kho`,
      beforeData: { status: current.status, items: current.items },
      afterData: {
        status: count.status,
        reviewedAt: count.reviewedAt,
        reviewNote: count.reviewNote,
        items: count.items,
      },
    });
    return this.serializeCount(count);
  }

  async reject(userId: number, id: number, dto: ReviewInventoryCountDto) {
    const reviewNote = dto.reviewNote?.trim();
    if (!reviewNote || reviewNote.length < 3) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }
    const current = await this.findOne(userId, 'ADMIN', id);
    if (current.status !== 'PENDING') {
      throw new BadRequestException('Chỉ phiếu đang chờ mới được từ chối');
    }
    const reviewedAt = new Date();
    const count = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.inventoryCount.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedById: userId,
          reviewedAt,
          reviewNote,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('Phiếu vừa được xử lý, vui lòng tải lại');
      }
      await tx.notification.create({
        data: {
          userId: current.createdById,
          type: 'INVENTORY_COUNT_REJECTED',
          title: 'Phiếu kiểm kê cần kiểm tra lại',
          message: `${current.code} bị từ chối: ${reviewNote}`,
        },
      });
      return tx.inventoryCount.findUniqueOrThrow({
        where: { id },
        include: countInclude,
      });
    });
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: count.branchId,
      module: 'INVENTORY',
      action: 'REJECT_INVENTORY_COUNT',
      entityType: 'InventoryCount',
      entityId: count.id,
      description: `Từ chối phiếu kiểm kê ${count.code}`,
      beforeData: { status: current.status },
      afterData: { status: 'REJECTED', reviewedAt, reviewNote },
    });
    return this.serializeCount(count);
  }

  async cancel(userId: number, role: string, id: number) {
    const current = await this.findOne(userId, role, id);
    if (!['DRAFT', 'PENDING'].includes(current.status)) {
      throw new BadRequestException('Phiếu kiểm kê này không thể hủy');
    }
    const claimed = await this.prisma.inventoryCount.updateMany({
      where: { id, status: { in: ['DRAFT', 'PENDING'] } },
      data: { status: 'CANCELLED' },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException('Phiếu vừa được xử lý, vui lòng tải lại');
    }
    const count = await this.prisma.inventoryCount.findUniqueOrThrow({
      where: { id },
      include: countInclude,
    });
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: count.branchId,
      module: 'INVENTORY',
      action: 'CANCEL_INVENTORY_COUNT',
      entityType: 'InventoryCount',
      entityId: count.id,
      description: `Hủy phiếu kiểm kê ${count.code}`,
      beforeData: { status: current.status },
      afterData: { status: 'CANCELLED' },
    });
    return this.serializeCount(count);
  }

  private async prepareItems(dto: CreateInventoryCountDto) {
    const ids = dto.items.map((item) => item.ingredientId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Một nguyên liệu không được lặp lại trong phiếu kiểm kê',
      );
    }
    const [ingredients, stocks] = await Promise.all([
      this.prisma.ingredient.findMany({
        where: { id: { in: ids }, isActive: true },
      }),
      this.prisma.inventoryStock.findMany({
        where: { branchId: dto.branchId, ingredientId: { in: ids } },
      }),
    ]);
    if (ingredients.length !== ids.length) {
      throw new BadRequestException('Phiếu có nguyên liệu không hợp lệ');
    }
    const stockByIngredient = new Map(
      stocks.map((stock) => [stock.ingredientId, this.number(stock.quantity)]),
    );
    return dto.items.map((item) => {
      const expectedQuantity = stockByIngredient.get(item.ingredientId) ?? 0;
      const differenceQuantity = this.roundQuantity(
        item.countedQuantity - expectedQuantity,
      );
      if (Math.abs(differenceQuantity) > 0.0005 && !item.reason) {
        const ingredient = ingredients.find(
          (value) => value.id === item.ingredientId,
        );
        throw new BadRequestException(
          `Vui lòng chọn lý do chênh lệch cho ${ingredient?.name ?? `nguyên liệu #${item.ingredientId}`}`,
        );
      }
      return {
        ingredientId: item.ingredientId,
        expectedQuantity,
        countedQuantity: item.countedQuantity,
        differenceQuantity,
        reason: Math.abs(differenceQuantity) > 0.0005 ? item.reason : undefined,
        note: item.note?.trim() || null,
      };
    });
  }

  private createCode(id: number, countedAt: Date) {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(countedAt)
      .replaceAll('-', '');
    return `KK-${date}-${String(id).padStart(4, '0')}`;
  }
}
