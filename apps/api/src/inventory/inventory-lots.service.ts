import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { DisposeInventoryLotDto } from './dto/dispose-inventory-lot.dto';
import {
  InventoryLotExpiryFilter,
  ListInventoryLotsDto,
} from './dto/list-inventory-lots.dto';
import { InventoryService } from './inventory.service';

type Tx = Prisma.TransactionClient;

const lotInclude = {
  branch: true,
  ingredient: true,
  stockReceiptItem: {
    include: { receipt: { select: { id: true, code: true } } },
  },
} satisfies Prisma.InventoryLotInclude;

@Injectable()
export class InventoryLotsService implements OnModuleInit, OnModuleDestroy {
  private expiryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  onModuleInit() {
    void this.syncExpiryNotifications(this.prisma).catch(() => undefined);
    this.expiryTimer = setInterval(
      () => {
        void this.syncExpiryNotifications(this.prisma).catch(() => undefined);
      },
      6 * 60 * 60 * 1000,
    );
    this.expiryTimer.unref();
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  private number(value: { toString(): string } | number) {
    return Number(value.toString());
  }

  private today() {
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return new Date(`${key}T00:00:00+07:00`);
  }

  private serialize<
    T extends {
      quantity: { toString(): string } | number;
      reservedQuantity: { toString(): string } | number;
      initialQuantity: { toString(): string } | number;
      unitCost: { toString(): string } | number;
      expiresAt: Date | null;
    },
  >(lot: T) {
    const quantity = this.number(lot.quantity);
    const reservedQuantity = this.number(lot.reservedQuantity);
    const daysToExpiry = lot.expiresAt
      ? Math.ceil(
          (lot.expiresAt.getTime() - this.today().getTime()) / 86_400_000,
        )
      : null;
    return {
      ...lot,
      quantity,
      reservedQuantity,
      availableQuantity: Math.max(0, quantity - reservedQuantity),
      initialQuantity: this.number(lot.initialQuantity),
      unitCost: this.number(lot.unitCost),
      inventoryValue: quantity * this.number(lot.unitCost),
      daysToExpiry,
      expiryState:
        daysToExpiry === null
          ? 'NO_EXPIRY'
          : daysToExpiry < 0
            ? 'EXPIRED'
            : daysToExpiry <= 7
              ? 'EXPIRING'
              : 'SAFE',
    };
  }

  async findAll(userId: number, role: string, query: ListInventoryLotsDto) {
    const branch = await this.inventoryService.getScopedBranch(
      userId,
      role,
      query.branchId,
    );
    await this.syncExpiryNotifications(this.prisma, branch.id);
    const today = this.today();
    const inSevenDays = new Date(today.getTime() + 7 * 86_400_000);
    const keyword = query.q?.trim();
    const expiryWhere: Prisma.InventoryLotWhereInput =
      query.expiry === InventoryLotExpiryFilter.EXPIRED
        ? { expiresAt: { lt: today } }
        : query.expiry === InventoryLotExpiryFilter.EXPIRING
          ? { expiresAt: { gte: today, lte: inSevenDays } }
          : query.expiry === InventoryLotExpiryFilter.NO_EXPIRY
            ? { expiresAt: null }
            : {};
    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        branchId: branch.id,
        ...(query.status ? { status: query.status } : {}),
        ...expiryWhere,
        ...(keyword
          ? {
              OR: [
                { code: { contains: keyword, mode: 'insensitive' } },
                { batchCode: { contains: keyword, mode: 'insensitive' } },
                {
                  ingredient: {
                    name: { contains: keyword, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
      include: lotInclude,
      orderBy: [
        { expiresAt: { sort: 'asc', nulls: 'last' } },
        { receivedAt: 'asc' },
        { id: 'asc' },
      ],
    });
    const rows = lots.map((lot) => this.serialize(lot));
    const branches =
      role === 'ADMIN'
        ? await this.prisma.storeBranch.findMany({ orderBy: { code: 'asc' } })
        : [branch];
    return {
      selectedBranch: branch,
      branches,
      lots: rows,
      summary: {
        total: rows.length,
        active: rows.filter(
          (lot) => lot.status === 'ACTIVE' && lot.quantity > 0,
        ).length,
        expiring: rows.filter((lot) => lot.expiryState === 'EXPIRING').length,
        expired: rows.filter(
          (lot) => lot.expiryState === 'EXPIRED' && lot.quantity > 0,
        ).length,
        inventoryValue: rows.reduce((sum, lot) => sum + lot.inventoryValue, 0),
      },
    };
  }

  async findOne(userId: number, role: string, id: number) {
    const lot = await this.prisma.inventoryLot.findUnique({
      where: { id },
      include: {
        ...lotInclude,
        allocations: {
          include: {
            order: { select: { id: true, status: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        disposals: {
          include: {
            actor: {
              select: { id: true, email: true, ...personProfileSelect },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lot) throw new NotFoundException('Không tìm thấy lô nguyên liệu');
    await this.inventoryService.getScopedBranch(userId, role, lot.branchId);
    return {
      ...this.serialize(lot),
      allocations: lot.allocations.map((item) => ({
        ...item,
        quantity: this.number(item.quantity),
        unitCost: this.number(item.unitCost),
        costAmount: this.number(item.costAmount),
      })),
      disposals: lot.disposals.map(({ actor, ...item }) => ({
        ...item,
        quantity: this.number(item.quantity),
        actor: actor ? flattenPersonProfile(actor) : null,
      })),
    };
  }

  async dispose(
    userId: number,
    role: string,
    id: number,
    dto: DisposeInventoryLotDto,
  ) {
    const current = await this.prisma.inventoryLot.findUnique({
      where: { id },
      include: lotInclude,
    });
    if (!current) throw new NotFoundException('Không tìm thấy lô nguyên liệu');
    await this.inventoryService.getScopedBranch(userId, role, current.branchId);
    const available =
      this.number(current.quantity) - this.number(current.reservedQuantity);
    if (dto.quantity > available + 0.0005) {
      throw new BadRequestException(
        `Lô chỉ còn ${Math.max(0, available)} ${current.ingredient.unit} chưa được giữ cho đơn`,
      );
    }
    const lot = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.inventoryLot.updateMany({
        where: {
          id,
          quantity: current.quantity,
          reservedQuantity: current.reservedQuantity,
        },
        data: {
          quantity: { decrement: dto.quantity },
          status:
            Math.abs(this.number(current.quantity) - dto.quantity) <= 0.0005
              ? 'DISPOSED'
              : current.status,
        },
      });
      if (claimed.count !== 1)
        throw new BadRequestException('Lô vừa thay đổi, vui lòng tải lại');
      const stockChanged = await tx.inventoryStock.updateMany({
        where: {
          branchId: current.branchId,
          ingredientId: current.ingredientId,
          quantity: {
            gte: this.number(current.reservedQuantity) + dto.quantity,
          },
        },
        data: { quantity: { decrement: dto.quantity } },
      });
      if (stockChanged.count !== 1)
        throw new BadRequestException(
          'Tồn tổng không khớp với lô, vui lòng kiểm kê lại',
        );
      const [updatedLot, stock] = await Promise.all([
        tx.inventoryLot.findUniqueOrThrow({
          where: { id },
          include: lotInclude,
        }),
        tx.inventoryStock.findUniqueOrThrow({
          where: {
            branchId_ingredientId: {
              branchId: current.branchId,
              ingredientId: current.ingredientId,
            },
          },
        }),
      ]);
      await tx.inventoryLotDisposal.create({
        data: {
          lotId: id,
          branchId: current.branchId,
          ingredientId: current.ingredientId,
          actorId: userId,
          quantity: dto.quantity,
          reason: dto.reason,
          note: dto.note?.trim() || null,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          branchId: current.branchId,
          ingredientId: current.ingredientId,
          lotId: id,
          actorId: userId,
          type: 'ADJUST',
          quantityDelta: -dto.quantity,
          reservedDelta: 0,
          quantityAfter: stock.quantity,
          reservedAfter: stock.reservedQuantity,
          note: `Hủy lô ${current.code}: ${dto.reason}${dto.note?.trim() ? ` - ${dto.note.trim()}` : ''}`,
        },
      });
      await this.inventoryService.syncLowStockNotification(tx, stock.id);
      return updatedLot;
    });
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: current.branchId,
      module: 'INVENTORY',
      action: 'DISPOSE_INVENTORY_LOT',
      entityType: 'InventoryLot',
      entityId: id,
      description: `Hủy ${dto.quantity} ${current.ingredient.unit} từ lô ${current.code}`,
      beforeData: { quantity: current.quantity, status: current.status },
      afterData: {
        quantity: lot.quantity,
        status: lot.status,
        reason: dto.reason,
        note: dto.note?.trim() || null,
      },
    });
    return this.serialize(lot);
  }

  async syncExpiryNotifications(tx: Tx | PrismaService, branchId?: number) {
    const today = this.today();
    const inSevenDays = new Date(today.getTime() + 7 * 86_400_000);
    const lots = await tx.inventoryLot.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        status: 'ACTIVE',
        quantity: { gt: 0 },
        expiresAt: { lte: inSevenDays },
        expiryNotifiedAt: null,
      },
      include: { ingredient: true, branch: true },
    });
    for (const lot of lots) {
      const expired = Boolean(lot.expiresAt && lot.expiresAt < today);
      const admins = await tx.user.findMany({
        where: { isActive: true, role: { name: 'ADMIN' } },
        select: { id: true },
      });
      const recipients = [
        ...new Set([
          ...admins.map((admin) => admin.id),
          ...(lot.branch.managerId ? [lot.branch.managerId] : []),
        ]),
      ];
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((userId) => ({
            userId,
            type: expired ? 'INVENTORY_LOT_EXPIRED' : 'INVENTORY_LOT_EXPIRING',
            title: expired
              ? `Lô ${lot.ingredient.name} đã hết hạn`
              : `Lô ${lot.ingredient.name} sắp hết hạn`,
            message: `${lot.branch.code} · ${lot.code} · hạn ${lot.expiresAt?.toLocaleDateString('vi-VN')}.`,
          })),
        });
      }
      await tx.inventoryLot.update({
        where: { id: lot.id },
        data: { expiryNotifiedAt: new Date() },
      });
    }
  }
}
