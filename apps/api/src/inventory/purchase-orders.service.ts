import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import type { PurchaseOrderStatus } from '../../generated/prisma/enums';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { ListPurchaseOrdersDto } from './dto/list-purchase-orders.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { ReviewPurchaseOrderDto } from './dto/review-purchase-order.dto';
import { InventoryService } from './inventory.service';

const purchaseOrderInclude = {
  branch: true,
  supplier: true,
  createdBy: { select: { id: true, email: true, ...personProfileSelect } },
  reviewedBy: { select: { id: true, email: true, ...personProfileSelect } },
  items: {
    include: { ingredient: true },
    orderBy: { id: 'asc' },
  },
  receipts: {
    include: {
      items: { include: { ingredient: true }, orderBy: { id: 'asc' } },
    },
    orderBy: { receivedAt: 'desc' },
  },
} satisfies Prisma.PurchaseOrderInclude;

type PurchaseOrderRecord = Prisma.PurchaseOrderGetPayload<{
  include: typeof purchaseOrderInclude;
}>;

const incomingStatuses: PurchaseOrderStatus[] = [
  'PENDING',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
];

@Injectable()
export class PurchaseOrdersService {
  private readonly usageWindowDays = 14;
  private readonly targetCoverDays = 7;

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

  private serializeOrder(order: PurchaseOrderRecord) {
    return {
      ...order,
      totalCost: this.number(order.totalCost),
      createdBy: flattenPersonProfile(order.createdBy),
      reviewedBy: order.reviewedBy
        ? flattenPersonProfile(order.reviewedBy)
        : null,
      items: order.items.map((item) => ({
        ...item,
        availableSnapshot: this.number(item.availableSnapshot),
        minimumLevelSnapshot: this.number(item.minimumLevelSnapshot),
        averageDailyUsage: this.number(item.averageDailyUsage),
        incomingSnapshot: this.number(item.incomingSnapshot),
        suggestedQuantity: this.number(item.suggestedQuantity),
        orderedQuantity: this.number(item.orderedQuantity),
        receivedQuantity: this.number(item.receivedQuantity),
        unitCost: this.number(item.unitCost),
        lineTotal: this.number(item.lineTotal),
      })),
      receipts: order.receipts.map((receipt) => ({
        ...receipt,
        totalCost: this.number(receipt.totalCost),
        items: receipt.items.map((item) => ({
          ...item,
          quantity: this.number(item.quantity),
          unitCost: this.number(item.unitCost),
          lineTotal: this.number(item.lineTotal),
        })),
      })),
    };
  }

  async getSuggestions(userId: number, role: string, branchId?: number) {
    const branch = await this.inventoryService.getScopedBranch(
      userId,
      role,
      branchId,
    );
    const branches =
      role === 'ADMIN'
        ? await this.prisma.storeBranch.findMany({ orderBy: { code: 'asc' } })
        : [branch];
    return {
      selectedBranch: branch,
      branches,
      usageWindowDays: this.usageWindowDays,
      targetCoverDays: this.targetCoverDays,
      rows: await this.buildSuggestionRows(branch.id),
    };
  }

  async findAll(userId: number, role: string, query: ListPurchaseOrdersDto) {
    const branch = await this.inventoryService.getScopedBranch(
      userId,
      role,
      query.branchId,
    );
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00+07:00`);
    if (query.to) {
      const end = new Date(`${query.to}T00:00:00+07:00`);
      end.setDate(end.getDate() + 1);
      createdAt.lt = end;
    }
    const keyword = query.q?.trim();
    const orders = await this.prisma.purchaseOrder.findMany({
      where: {
        branchId: branch.id,
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
        ...(keyword
          ? {
              OR: [
                { code: { contains: keyword, mode: 'insensitive' } },
                { note: { contains: keyword, mode: 'insensitive' } },
                {
                  supplier: {
                    name: { contains: keyword, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
      include: purchaseOrderInclude,
      orderBy: { createdAt: 'desc' },
    });
    const branches =
      role === 'ADMIN'
        ? await this.prisma.storeBranch.findMany({ orderBy: { code: 'asc' } })
        : [branch];
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const today = new Date(`${todayKey}T00:00:00+07:00`);
    return {
      selectedBranch: branch,
      branches,
      orders: orders.map((order) => this.serializeOrder(order)),
      summary: {
        total: orders.length,
        pending: orders.filter((order) => order.status === 'PENDING').length,
        inTransit: orders.filter((order) =>
          ['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status),
        ).length,
        overdue: orders.filter(
          (order) =>
            order.expectedAt &&
            order.expectedAt < today &&
            ['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status),
        ).length,
        completed: orders.filter((order) => order.status === 'COMPLETED')
          .length,
        openValue: orders
          .filter((order) =>
            ['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(
              order.status,
            ),
          )
          .reduce((sum, order) => sum + this.number(order.totalCost), 0),
      },
    };
  }

  async findOne(userId: number, role: string, id: number) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: purchaseOrderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn đặt hàng');
    await this.inventoryService.getScopedBranch(userId, role, order.branchId);
    return this.serializeOrder(order);
  }

  async create(userId: number, role: string, dto: CreatePurchaseOrderDto) {
    await this.inventoryService.getScopedBranch(userId, role, dto.branchId);
    const prepared = await this.prepareItems(dto);
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          code: `TMP-${randomUUID().slice(0, 18)}`,
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          createdById: userId,
          expectedAt: this.parseDate(dto.expectedAt),
          note: dto.note?.trim() || null,
          totalCost: prepared.totalCost,
          items: { create: prepared.items },
        },
      });
      return tx.purchaseOrder.update({
        where: { id: created.id },
        data: { code: this.createCode(created.id, created.createdAt) },
        include: purchaseOrderInclude,
      });
    });
    await this.writeAudit(userId, order, 'CREATE_PURCHASE_ORDER', 'Lập', null);
    return this.serializeOrder(order);
  }

  async update(
    userId: number,
    role: string,
    id: number,
    dto: UpdatePurchaseOrderDto,
  ) {
    const current = await this.getRawOrder(userId, role, id);
    if (!['DRAFT', 'REJECTED'].includes(current.status)) {
      throw new BadRequestException(
        'Chỉ đơn nháp hoặc bị từ chối mới được sửa',
      );
    }
    if (current.branchId !== dto.branchId) {
      throw new BadRequestException('Không thể đổi chi nhánh của đơn đã lập');
    }
    const prepared = await this.prepareItems(dto);
    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id, status: { in: ['DRAFT', 'REJECTED'] } },
        data: {
          supplierId: dto.supplierId,
          status: 'DRAFT',
          expectedAt: this.parseDate(dto.expectedAt),
          note: dto.note?.trim() || null,
          reviewNote: null,
          reviewedAt: null,
          reviewedById: null,
          submittedAt: null,
          totalCost: prepared.totalCost,
        },
      });
      if (claimed.count !== 1) this.throwChanged();
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrderItem.createMany({
        data: prepared.items.map((item) => ({ purchaseOrderId: id, ...item })),
      });
      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: purchaseOrderInclude,
      });
    });
    await this.writeAudit(
      userId,
      order,
      'UPDATE_PURCHASE_ORDER',
      'Cập nhật',
      current,
    );
    return this.serializeOrder(order);
  }

  async submit(userId: number, role: string, id: number) {
    const current = await this.getRawOrder(userId, role, id);
    if (current.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ đơn nháp mới được gửi duyệt');
    }
    const submittedAt = new Date();
    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'PENDING', submittedAt },
      });
      if (claimed.count !== 1) this.throwChanged();
      const admins = await tx.user.findMany({
        where: { isActive: true, role: { name: 'ADMIN' } },
        select: { id: true },
      });
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: 'PURCHASE_ORDER_SUBMITTED',
            title: 'Có đề xuất nhập hàng chờ duyệt',
            message: `${current.branch.code} vừa gửi đơn ${current.code} từ ${current.supplier.name}.`,
          })),
        });
      }
      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: purchaseOrderInclude,
      });
    });
    await this.writeAudit(
      userId,
      order,
      'SUBMIT_PURCHASE_ORDER',
      'Gửi duyệt',
      current,
    );
    return this.serializeOrder(order);
  }

  async approve(userId: number, id: number, dto: ReviewPurchaseOrderDto) {
    const current = await this.getRawOrder(userId, 'ADMIN', id);
    if (current.status !== 'PENDING') {
      throw new BadRequestException('Chỉ đề xuất đang chờ mới được duyệt');
    }
    const reviewedAt = new Date();
    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          reviewedById: userId,
          reviewedAt,
          reviewNote: dto.note?.trim() || null,
        },
      });
      if (claimed.count !== 1) this.throwChanged();
      await tx.notification.create({
        data: {
          userId: current.createdById,
          type: 'PURCHASE_ORDER_APPROVED',
          title: 'Đề xuất nhập hàng đã được duyệt',
          message: `${current.code} đã được Admin duyệt.`,
        },
      });
      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: purchaseOrderInclude,
      });
    });
    await this.writeAudit(
      userId,
      order,
      'APPROVE_PURCHASE_ORDER',
      'Duyệt',
      current,
    );
    return this.serializeOrder(order);
  }

  async reject(userId: number, id: number, dto: ReviewPurchaseOrderDto) {
    const reviewNote = dto.note?.trim();
    if (!reviewNote || reviewNote.length < 3) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }
    const current = await this.getRawOrder(userId, 'ADMIN', id);
    if (current.status !== 'PENDING') {
      throw new BadRequestException('Chỉ đề xuất đang chờ mới được từ chối');
    }
    const reviewedAt = new Date();
    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedById: userId,
          reviewedAt,
          reviewNote,
        },
      });
      if (claimed.count !== 1) this.throwChanged();
      await tx.notification.create({
        data: {
          userId: current.createdById,
          type: 'PURCHASE_ORDER_REJECTED',
          title: 'Đề xuất nhập hàng cần chỉnh lại',
          message: `${current.code} bị từ chối: ${reviewNote}`,
        },
      });
      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: purchaseOrderInclude,
      });
    });
    await this.writeAudit(
      userId,
      order,
      'REJECT_PURCHASE_ORDER',
      'Từ chối',
      current,
    );
    return this.serializeOrder(order);
  }

  async markOrdered(userId: number, id: number) {
    const current = await this.getRawOrder(userId, 'ADMIN', id);
    if (current.status !== 'APPROVED') {
      throw new BadRequestException('Đơn phải được duyệt trước khi đặt hàng');
    }
    const orderedAt = new Date();
    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id, status: 'APPROVED' },
        data: { status: 'ORDERED', orderedAt },
      });
      if (claimed.count !== 1) this.throwChanged();
      const recipientIds = [
        ...new Set(
          [current.createdById, current.branch.managerId].filter(
            (value): value is number => typeof value === 'number',
          ),
        ),
      ];
      if (recipientIds.length) {
        await tx.notification.createMany({
          data: recipientIds.map((recipientId) => ({
            userId: recipientId,
            type: 'PURCHASE_ORDER_ORDERED',
            title: 'Đơn nguyên liệu đã gửi nhà cung cấp',
            message: `${current.code} đã được xác nhận đặt với ${current.supplier.name}.`,
          })),
        });
      }
      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: purchaseOrderInclude,
      });
    });
    await this.writeAudit(
      userId,
      order,
      'MARK_PURCHASE_ORDERED',
      'Xác nhận đã đặt',
      current,
    );
    return this.serializeOrder(order);
  }

  async cancel(userId: number, role: string, id: number) {
    const current = await this.getRawOrder(userId, role, id);
    const allowed =
      role === 'ADMIN'
        ? ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED']
        : ['DRAFT', 'PENDING'];
    if (!allowed.includes(current.status)) {
      throw new BadRequestException('Đơn đặt hàng này không thể hủy');
    }
    if (current.items.some((item) => this.number(item.receivedQuantity) > 0)) {
      throw new BadRequestException('Không thể hủy đơn đã có hàng được nhận');
    }
    const cancelledAt = new Date();
    const claimed = await this.prisma.purchaseOrder.updateMany({
      where: { id, status: { in: allowed as PurchaseOrderStatus[] } },
      data: { status: 'CANCELLED', cancelledAt },
    });
    if (claimed.count !== 1) this.throwChanged();
    const order = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: purchaseOrderInclude,
    });
    await this.writeAudit(
      userId,
      order,
      'CANCEL_PURCHASE_ORDER',
      'Hủy',
      current,
    );
    return this.serializeOrder(order);
  }

  async receive(
    userId: number,
    role: string,
    id: number,
    dto: ReceivePurchaseOrderDto,
  ) {
    const current = await this.getRawOrder(userId, role, id);
    if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(current.status)) {
      throw new BadRequestException(
        'Chỉ đơn đã đặt mới được xác nhận nhận hàng',
      );
    }
    const itemIds = dto.items.map((item) => item.purchaseOrderItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException('Một dòng nguyên liệu không được lặp lại');
    }
    const itemById = new Map(current.items.map((item) => [item.id, item]));
    for (const input of dto.items) {
      const item = itemById.get(input.purchaseOrderItemId);
      if (!item)
        throw new BadRequestException('Đơn có nguyên liệu không hợp lệ');
      const remaining =
        this.number(item.orderedQuantity) - this.number(item.receivedQuantity);
      if (input.quantity > remaining + 0.0005) {
        throw new BadRequestException(
          `${item.ingredient.name} chỉ còn ${this.roundQuantity(remaining)} ${item.ingredient.unit} chưa nhận`,
        );
      }
    }

    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
    for (const input of dto.items) this.validateLotDates(input, receivedAt);
    const receiptCodePlaceholder = `TMP-${randomUUID().slice(0, 18)}`;
    const result = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.stockReceipt.create({
        data: {
          code: receiptCodePlaceholder,
          branchId: current.branchId,
          supplierId: current.supplierId,
          purchaseOrderId: current.id,
          createdById: userId,
          status: 'COMPLETED',
          receivedAt,
          note: dto.note?.trim() || `Nhận hàng theo ${current.code}`,
          totalCost: dto.items.reduce((sum, input) => {
            const item = itemById.get(input.purchaseOrderItemId)!;
            return sum + input.quantity * this.number(item.unitCost);
          }, 0),
          items: {
            create: dto.items.map((input) => {
              const item = itemById.get(input.purchaseOrderItemId)!;
              return {
                ingredientId: item.ingredientId,
                purchaseOrderItemId: item.id,
                quantity: input.quantity,
                unitCost: item.unitCost,
                lineTotal: input.quantity * this.number(item.unitCost),
                batchCode: input.batchCode?.trim() || null,
                manufacturedAt: this.parseLotDate(input.manufacturedAt),
                expiresAt: this.parseLotDate(input.expiresAt),
                lotNote: input.lotNote?.trim() || null,
              };
            }),
          },
        },
        include: { items: true },
      });
      const receiptCode = this.createReceiptCode(receipt.id, receivedAt);
      await tx.stockReceipt.update({
        where: { id: receipt.id },
        data: { code: receiptCode },
      });

      for (const input of dto.items) {
        const item = itemById.get(input.purchaseOrderItemId)!;
        const receiptItem = receipt.items.find(
          (value) => value.purchaseOrderItemId === item.id,
        );
        if (!receiptItem) this.throwChanged();
        const lot = await tx.inventoryLot.create({
          data: {
            code: `LOT-${receipt.id}-${receiptItem.id}`,
            batchCode: input.batchCode?.trim() || receiptCode,
            branchId: current.branchId,
            ingredientId: item.ingredientId,
            stockReceiptItemId: receiptItem.id,
            manufacturedAt: this.parseLotDate(input.manufacturedAt),
            expiresAt: this.parseLotDate(input.expiresAt),
            receivedAt,
            initialQuantity: input.quantity,
            quantity: input.quantity,
            unitCost: item.unitCost,
            note: input.lotNote?.trim() || null,
          },
        });
        const claimedItem = await tx.purchaseOrderItem.updateMany({
          where: {
            id: item.id,
            receivedQuantity: item.receivedQuantity,
          },
          data: { receivedQuantity: { increment: input.quantity } },
        });
        if (claimedItem.count !== 1) this.throwChanged();
        const stock = await tx.inventoryStock.upsert({
          where: {
            branchId_ingredientId: {
              branchId: current.branchId,
              ingredientId: item.ingredientId,
            },
          },
          create: {
            branchId: current.branchId,
            ingredientId: item.ingredientId,
            quantity: input.quantity,
          },
          update: { quantity: { increment: input.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            branchId: current.branchId,
            ingredientId: item.ingredientId,
            lotId: lot.id,
            stockReceiptId: receipt.id,
            actorId: userId,
            type: 'RECEIVE',
            quantityDelta: input.quantity,
            reservedDelta: 0,
            quantityAfter: stock.quantity,
            reservedAfter: stock.reservedQuantity,
            note: `Nhận hàng ${receiptCode} theo đơn ${current.code}`,
          },
        });
        await this.inventoryService.syncLowStockNotification(tx, stock.id);
      }

      const refreshedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: current.id },
      });
      const allReceived = refreshedItems.every(
        (item) =>
          this.number(item.receivedQuantity) + 0.0005 >=
          this.number(item.orderedQuantity),
      );
      const nextStatus: PurchaseOrderStatus = allReceived
        ? 'COMPLETED'
        : 'PARTIALLY_RECEIVED';
      const claimedOrder = await tx.purchaseOrder.updateMany({
        where: {
          id: current.id,
          status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] },
        },
        data: {
          status: nextStatus,
          completedAt: allReceived ? receivedAt : null,
        },
      });
      if (claimedOrder.count !== 1) this.throwChanged();

      const admins = await tx.user.findMany({
        where: { isActive: true, role: { name: 'ADMIN' } },
        select: { id: true },
      });
      const recipientIds = [
        ...new Set(
          [
            ...admins.map((admin) => admin.id),
            current.createdById,
            current.branch.managerId,
          ].filter((value): value is number => typeof value === 'number'),
        ),
      ].filter((recipientId) => recipientId !== userId);
      if (recipientIds.length) {
        await tx.notification.createMany({
          data: recipientIds.map((recipientId) => ({
            userId: recipientId,
            type: allReceived
              ? 'PURCHASE_ORDER_COMPLETED'
              : 'PURCHASE_ORDER_PARTIALLY_RECEIVED',
            title: allReceived
              ? 'Đã nhận đủ đơn nguyên liệu'
              : 'Đã nhận một phần đơn nguyên liệu',
            message: `${receiptCode} đã cộng vào kho cho đơn ${current.code}.`,
          })),
        });
      }
      return {
        order: await tx.purchaseOrder.findUniqueOrThrow({
          where: { id: current.id },
          include: purchaseOrderInclude,
        }),
        receiptCode,
      };
    });

    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: result.order.branchId,
      module: 'INVENTORY',
      action: 'RECEIVE_PURCHASE_ORDER',
      entityType: 'PurchaseOrder',
      entityId: result.order.id,
      description: `Nhận hàng ${result.receiptCode} cho đơn ${result.order.code}`,
      beforeData: this.auditSnapshot(current),
      afterData: {
        ...this.auditSnapshot(result.order),
        receiptCode: result.receiptCode,
      },
    });
    return this.serializeOrder(result.order);
  }

  private async prepareItems(dto: CreatePurchaseOrderDto) {
    const ingredientIds = dto.items.map((item) => item.ingredientId);
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      throw new BadRequestException(
        'Một nguyên liệu không được lặp lại trong đơn',
      );
    }
    const [supplier, ingredients, suggestions] = await Promise.all([
      this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, isActive: true },
      }),
      this.prisma.ingredient.findMany({
        where: { id: { in: ingredientIds }, isActive: true },
      }),
      this.buildSuggestionRows(dto.branchId),
    ]);
    if (!supplier) throw new BadRequestException('Nhà cung cấp không hợp lệ');
    if (ingredients.length !== ingredientIds.length) {
      throw new BadRequestException('Đơn có nguyên liệu không hợp lệ');
    }
    const suggestionByIngredient = new Map(
      suggestions.map((row) => [row.ingredient.id, row]),
    );
    const items = dto.items.map((input) => {
      const row = suggestionByIngredient.get(input.ingredientId);
      return {
        ingredientId: input.ingredientId,
        availableSnapshot: row?.availableQuantity ?? 0,
        minimumLevelSnapshot: row?.minimumLevel ?? 0,
        averageDailyUsage: row?.averageDailyUsage ?? 0,
        incomingSnapshot: row?.incomingQuantity ?? 0,
        suggestedQuantity: row?.suggestedQuantity ?? 0,
        orderedQuantity: input.quantity,
        unitCost: input.unitCost,
        lineTotal: input.quantity * input.unitCost,
        note: input.note?.trim() || null,
      };
    });
    return {
      items,
      totalCost: items.reduce((sum, item) => sum + item.lineTotal, 0),
    };
  }

  private async buildSuggestionRows(branchId: number) {
    const usageSince = new Date();
    usageSince.setDate(usageSince.getDate() - this.usageWindowDays);
    const [ingredients, stocks, usage, incoming, recentReceiptItems] =
      await Promise.all([
        this.prisma.ingredient.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.inventoryStock.findMany({ where: { branchId } }),
        this.prisma.inventoryMovement.groupBy({
          by: ['ingredientId'],
          where: {
            branchId,
            type: 'CONSUME',
            createdAt: { gte: usageSince },
          },
          _sum: { quantityDelta: true },
        }),
        this.prisma.purchaseOrderItem.groupBy({
          by: ['ingredientId'],
          where: {
            purchaseOrder: {
              branchId,
              status: { in: incomingStatuses },
            },
          },
          _sum: { orderedQuantity: true, receivedQuantity: true },
        }),
        this.prisma.stockReceiptItem.findMany({
          where: {
            receipt: { branchId, status: 'COMPLETED' },
          },
          include: {
            receipt: { include: { supplier: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        }),
      ]);
    const stockByIngredient = new Map(
      stocks.map((stock) => [stock.ingredientId, stock]),
    );
    const usageByIngredient = new Map(
      usage.map((row) => [
        row.ingredientId,
        Math.abs(this.number(row._sum.quantityDelta ?? 0)),
      ]),
    );
    const incomingByIngredient = new Map(
      incoming.map((row) => [
        row.ingredientId,
        Math.max(
          0,
          this.number(row._sum.orderedQuantity ?? 0) -
            this.number(row._sum.receivedQuantity ?? 0),
        ),
      ]),
    );
    const lastReceiptByIngredient = new Map<
      number,
      (typeof recentReceiptItems)[number]
    >();
    for (const item of recentReceiptItems) {
      if (!lastReceiptByIngredient.has(item.ingredientId)) {
        lastReceiptByIngredient.set(item.ingredientId, item);
      }
    }
    return ingredients
      .map((ingredient) => {
        const stock = stockByIngredient.get(ingredient.id);
        const availableQuantity = Math.max(
          0,
          this.number(stock?.quantity ?? 0) -
            this.number(stock?.reservedQuantity ?? 0),
        );
        const minimumLevel = this.number(stock?.minimumLevel ?? 0);
        const usageQuantity = usageByIngredient.get(ingredient.id) ?? 0;
        const averageDailyUsage = this.roundQuantity(
          usageQuantity / this.usageWindowDays,
        );
        const incomingQuantity = this.roundQuantity(
          incomingByIngredient.get(ingredient.id) ?? 0,
        );
        const targetQuantity = this.roundQuantity(
          minimumLevel + averageDailyUsage * this.targetCoverDays,
        );
        const suggestedQuantity = this.roundQuantity(
          Math.max(0, targetQuantity - availableQuantity - incomingQuantity),
        );
        const lastReceipt = lastReceiptByIngredient.get(ingredient.id);
        return {
          ingredient,
          availableQuantity: this.roundQuantity(availableQuantity),
          minimumLevel,
          usageQuantity: this.roundQuantity(usageQuantity),
          averageDailyUsage,
          incomingQuantity,
          targetQuantity,
          suggestedQuantity,
          lastUnitCost: lastReceipt ? this.number(lastReceipt.unitCost) : null,
          lastSupplier: lastReceipt?.receipt.supplier ?? null,
          lastReceivedAt: lastReceipt?.receipt.receivedAt ?? null,
        };
      })
      .sort(
        (left, right) =>
          Number(right.suggestedQuantity > 0) -
            Number(left.suggestedQuantity > 0) ||
          left.ingredient.name.localeCompare(right.ingredient.name, 'vi'),
      );
  }

  private async getRawOrder(userId: number, role: string, id: number) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: purchaseOrderInclude,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn đặt hàng');
    await this.inventoryService.getScopedBranch(userId, role, order.branchId);
    return order;
  }

  private parseDate(value?: string) {
    return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
  }

  private parseLotDate(value?: string) {
    return value ? new Date(`${value.slice(0, 10)}T00:00:00+07:00`) : null;
  }

  private validateLotDates(
    item: { manufacturedAt?: string; expiresAt?: string },
    receivedAt: Date,
  ) {
    const manufacturedAt = this.parseLotDate(item.manufacturedAt);
    const expiresAt = this.parseLotDate(item.expiresAt);
    if (manufacturedAt && expiresAt && expiresAt <= manufacturedAt) {
      throw new BadRequestException('Hạn dùng phải sau ngày sản xuất');
    }
    if (manufacturedAt && manufacturedAt > receivedAt) {
      throw new BadRequestException('Ngày sản xuất không được sau ngày nhận hàng');
    }
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    if (expiresAt && expiresAt < new Date(`${todayKey}T00:00:00+07:00`)) {
      throw new BadRequestException('Không thể nhập lô đã hết hạn');
    }
  }

  private createCode(id: number, createdAt: Date) {
    const date = createdAt.toISOString().slice(0, 10).replaceAll('-', '');
    return `DH-${date}-${String(id).padStart(6, '0')}`;
  }

  private createReceiptCode(id: number, receivedAt: Date) {
    const date = receivedAt.toISOString().slice(0, 10).replaceAll('-', '');
    return `PN-${date}-${String(id).padStart(6, '0')}`;
  }

  private throwChanged(): never {
    throw new BadRequestException(
      'Đơn vừa thay đổi trạng thái, vui lòng tải lại',
    );
  }

  private auditSnapshot(order: PurchaseOrderRecord) {
    return {
      code: order.code,
      status: order.status,
      supplierId: order.supplierId,
      expectedAt: order.expectedAt,
      note: order.note,
      reviewNote: order.reviewNote,
      totalCost: order.totalCost,
      submittedAt: order.submittedAt,
      reviewedAt: order.reviewedAt,
      orderedAt: order.orderedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      items: order.items,
    };
  }

  private async writeAudit(
    userId: number,
    order: PurchaseOrderRecord,
    action: string,
    verb: string,
    before: PurchaseOrderRecord | null,
  ) {
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: order.branchId,
      module: 'INVENTORY',
      action,
      entityType: 'PurchaseOrder',
      entityId: order.id,
      description: `${verb} đơn nhập hàng ${order.code}`,
      beforeData: before ? this.auditSnapshot(before) : undefined,
      afterData: this.auditSnapshot(order),
    });
  }
}
