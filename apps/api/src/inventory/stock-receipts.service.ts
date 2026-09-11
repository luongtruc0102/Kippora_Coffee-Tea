import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { ListStockReceiptsDto } from './dto/list-stock-receipts.dto';
import { InventoryService } from './inventory.service';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';

const receiptInclude = {
  branch: true,
  supplier: true,
  createdBy: { select: { id: true, email: true, ...personProfileSelect } },
  items: {
    include: { ingredient: true, lots: true },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.StockReceiptInclude;

@Injectable()
export class StockReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  private number(value: { toString(): string } | number) {
    return Number(value.toString());
  }

  private serializeReceipt<
    T extends {
      createdBy: {
        id: number;
        email: string;
        profile: {
          fullName: string | null;
          phone: string | null;
          avatarUrl: string | null;
        } | null;
      };
    },
  >(receipt: T) {
    return {
      ...receipt,
      createdBy: flattenPersonProfile(receipt.createdBy),
    };
  }

  async findAll(userId: number, role: string, query: ListStockReceiptsDto) {
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
    const receipts = await this.prisma.stockReceipt.findMany({
      where: {
        branchId: branch.id,
        ...(query.status ? { status: query.status } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
        ...(keyword
          ? {
              OR: [
                { code: { contains: keyword, mode: 'insensitive' } },
                {
                  supplier: {
                    name: { contains: keyword, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
      include: receiptInclude,
      orderBy: { createdAt: 'desc' },
    });
    const branches =
      role === 'ADMIN'
        ? await this.prisma.storeBranch.findMany({ orderBy: { code: 'asc' } })
        : [branch];
    const completed = receipts.filter((item) => item.status === 'COMPLETED');
    return {
      selectedBranch: branch,
      branches,
      receipts: receipts.map((receipt) => this.serializeReceipt(receipt)),
      summary: {
        total: receipts.length,
        draft: receipts.filter((item) => item.status === 'DRAFT').length,
        completed: completed.length,
        totalCost: completed.reduce(
          (sum, item) => sum + this.number(item.totalCost),
          0,
        ),
      },
    };
  }

  async findOne(userId: number, role: string, id: number) {
    const receipt = await this.prisma.stockReceipt.findUnique({
      where: { id },
      include: receiptInclude,
    });
    if (!receipt) throw new NotFoundException('Không tìm thấy phiếu nhập');
    await this.inventoryService.getScopedBranch(userId, role, receipt.branchId);
    return this.serializeReceipt(receipt);
  }

  async create(userId: number, role: string, dto: CreateStockReceiptDto) {
    await this.inventoryService.getScopedBranch(userId, role, dto.branchId);
    const prepared = this.prepareItems(dto);
    await this.assertReferences(dto);
    const receipt = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.stockReceipt.create({
        data: {
          code: `TMP-${randomUUID().slice(0, 18)}`,
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          createdById: userId,
          note: dto.note?.trim() || null,
          totalCost: prepared.totalCost,
          items: { create: prepared.items },
        },
      });
      return tx.stockReceipt.update({
        where: { id: receipt.id },
        data: { code: this.createCode(receipt.id, receipt.createdAt) },
        include: receiptInclude,
      });
    });
    const result = this.serializeReceipt(receipt);
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: receipt.branchId,
      module: 'INVENTORY',
      action: 'CREATE_STOCK_RECEIPT',
      entityType: 'StockReceipt',
      entityId: receipt.id,
      description: `Tạo phiếu nhập kho ${receipt.code}`,
      afterData: {
        code: receipt.code,
        status: receipt.status,
        supplierId: receipt.supplierId,
        note: receipt.note,
        totalCost: receipt.totalCost,
        items: receipt.items,
      },
    });
    return result;
  }

  async update(
    userId: number,
    role: string,
    id: number,
    dto: CreateStockReceiptDto,
  ) {
    const current = await this.findOne(userId, role, id);
    if (current.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ phiếu nháp mới được chỉnh sửa');
    }
    if (dto.branchId !== current.branchId) {
      throw new BadRequestException('Không thể đổi chi nhánh của phiếu đã tạo');
    }
    const prepared = this.prepareItems(dto);
    await this.inventoryService.getScopedBranch(userId, role, dto.branchId);
    await this.assertReferences(dto);
    const receipt = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.stockReceipt.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          note: dto.note?.trim() || null,
          totalCost: prepared.totalCost,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Phiếu vừa thay đổi trạng thái, vui lòng tải lại',
        );
      }
      await tx.stockReceiptItem.deleteMany({ where: { receiptId: id } });
      await tx.stockReceiptItem.createMany({
        data: prepared.items.map((item) => ({ receiptId: id, ...item })),
      });
      return tx.stockReceipt.findUniqueOrThrow({
        where: { id },
        include: receiptInclude,
      });
    });
    const result = this.serializeReceipt(receipt);
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: receipt.branchId,
      module: 'INVENTORY',
      action: 'UPDATE_STOCK_RECEIPT',
      entityType: 'StockReceipt',
      entityId: receipt.id,
      description: `Chỉnh sửa phiếu nhập kho ${receipt.code}`,
      beforeData: {
        supplierId: current.supplierId,
        note: current.note,
        totalCost: current.totalCost,
        items: current.items,
      },
      afterData: {
        supplierId: receipt.supplierId,
        note: receipt.note,
        totalCost: receipt.totalCost,
        items: receipt.items,
      },
    });
    return result;
  }

  async complete(userId: number, role: string, id: number) {
    const current = await this.findOne(userId, role, id);
    if (current.status !== 'DRAFT') {
      throw new BadRequestException('Phiếu nhập không còn ở trạng thái nháp');
    }
    const completedReceipt = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.stockReceipt.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'COMPLETED', receivedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Phiếu vừa thay đổi trạng thái, vui lòng tải lại',
        );
      }
      const receipt = await tx.stockReceipt.findUniqueOrThrow({
        where: { id },
        include: receiptInclude,
      });
      for (const item of receipt.items) {
        this.validateLotDates(item, receipt.receivedAt ?? new Date());
        const lot = await tx.inventoryLot.create({
          data: {
            code: `LOT-${receipt.id}-${item.id}`,
            batchCode: item.batchCode?.trim() || receipt.code,
            branchId: receipt.branchId,
            ingredientId: item.ingredientId,
            stockReceiptItemId: item.id,
            manufacturedAt: item.manufacturedAt,
            expiresAt: item.expiresAt,
            receivedAt: receipt.receivedAt ?? new Date(),
            initialQuantity: item.quantity,
            quantity: item.quantity,
            unitCost: item.unitCost,
            note: item.lotNote?.trim() || null,
          },
        });
        const stock = await tx.inventoryStock.upsert({
          where: {
            branchId_ingredientId: {
              branchId: receipt.branchId,
              ingredientId: item.ingredientId,
            },
          },
          create: {
            branchId: receipt.branchId,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
          },
          update: { quantity: { increment: item.quantity } },
        });
        const available =
          this.number(stock.quantity) - this.number(stock.reservedQuantity);
        if (
          stock.lowStockNotifiedAt &&
          available > this.number(stock.minimumLevel)
        ) {
          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: { lowStockNotifiedAt: null },
          });
        }
        await tx.inventoryMovement.create({
          data: {
            branchId: receipt.branchId,
            ingredientId: item.ingredientId,
            lotId: lot.id,
            stockReceiptId: id,
            actorId: userId,
            type: 'RECEIVE',
            quantityDelta: item.quantity,
            reservedDelta: 0,
            quantityAfter: stock.quantity,
            reservedAfter: stock.reservedQuantity,
            note: `Nhập kho theo phiếu ${receipt.code}`,
          },
        });
      }
      return tx.stockReceipt.findUniqueOrThrow({
        where: { id },
        include: receiptInclude,
      });
    });
    const result = this.serializeReceipt(completedReceipt);
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: completedReceipt.branchId,
      module: 'INVENTORY',
      action: 'COMPLETE_STOCK_RECEIPT',
      entityType: 'StockReceipt',
      entityId: completedReceipt.id,
      description: `Hoàn tất nhập kho theo phiếu ${completedReceipt.code}`,
      beforeData: { status: current.status },
      afterData: {
        status: completedReceipt.status,
        receivedAt: completedReceipt.receivedAt,
        totalCost: completedReceipt.totalCost,
        items: completedReceipt.items,
      },
    });
    return result;
  }

  async cancel(userId: number, role: string, id: number) {
    const current = await this.findOne(userId, role, id);
    if (current.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ phiếu nháp mới được hủy');
    }
    const claimed = await this.prisma.stockReceipt.updateMany({
      where: { id, status: 'DRAFT' },
      data: { status: 'CANCELLED' },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException(
        'Phiếu vừa thay đổi trạng thái, vui lòng tải lại',
      );
    }
    const receipt = await this.prisma.stockReceipt.findUniqueOrThrow({
      where: { id },
      include: receiptInclude,
    });
    const result = this.serializeReceipt(receipt);
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: receipt.branchId,
      module: 'INVENTORY',
      action: 'CANCEL_STOCK_RECEIPT',
      entityType: 'StockReceipt',
      entityId: receipt.id,
      description: `Hủy phiếu nhập kho ${receipt.code}`,
      beforeData: { status: current.status },
      afterData: { status: receipt.status },
    });
    return result;
  }

  private prepareItems(dto: CreateStockReceiptDto) {
    const ids = dto.items.map((item) => item.ingredientId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Một nguyên liệu không được lặp lại trong phiếu',
      );
    }
    const items = dto.items.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      lineTotal: item.quantity * item.unitCost,
      batchCode: item.batchCode?.trim() || null,
      manufacturedAt: item.manufacturedAt
        ? new Date(`${item.manufacturedAt}T00:00:00+07:00`)
        : null,
      expiresAt: item.expiresAt
        ? new Date(`${item.expiresAt}T00:00:00+07:00`)
        : null,
      lotNote: item.lotNote?.trim() || null,
    }));
    for (const item of items) this.validateLotDates(item);
    return {
      items,
      totalCost: items.reduce((sum, item) => sum + item.lineTotal, 0),
    };
  }

  private async assertReferences(dto: CreateStockReceiptDto) {
    const [supplier, ingredientCount] = await Promise.all([
      this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, isActive: true },
      }),
      this.prisma.ingredient.count({
        where: {
          id: { in: [...new Set(dto.items.map((item) => item.ingredientId))] },
          isActive: true,
        },
      }),
    ]);
    if (!supplier) {
      throw new BadRequestException('Nhà cung cấp không hoạt động');
    }
    if (
      ingredientCount !==
      new Set(dto.items.map((item) => item.ingredientId)).size
    ) {
      throw new BadRequestException('Phiếu có nguyên liệu không hợp lệ');
    }
  }

  private createCode(id: number, createdAt: Date) {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(createdAt)
      .replaceAll('-', '');
    return `PN-${date}-${String(id).padStart(6, '0')}`;
  }

  private validateLotDates(
    item: { manufacturedAt: Date | null; expiresAt: Date | null },
    receivedAt?: Date,
  ) {
    if (
      item.manufacturedAt &&
      item.expiresAt &&
      item.expiresAt <= item.manufacturedAt
    ) {
      throw new BadRequestException('Hạn dùng phải sau ngày sản xuất');
    }
    if (item.manufacturedAt && receivedAt && item.manufacturedAt > receivedAt) {
      throw new BadRequestException('Ngày sản xuất không được sau ngày nhận hàng');
    }
    if (item.expiresAt) {
      const todayKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      if (item.expiresAt < new Date(`${todayKey}T00:00:00+07:00`)) {
        throw new BadRequestException('Không thể nhập lô đã hết hạn');
      }
    }
  }
}
