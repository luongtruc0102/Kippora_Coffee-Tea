import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { IngredientUnit } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private number(value: { toString(): string } | number) {
    return Number(value.toString());
  }

  async getScopedBranch(userId: number, role: string, requested?: number) {
    if (role === 'ADMIN') {
      const branch = await this.prisma.storeBranch.findFirst({
        where: requested ? { id: requested } : { isActive: true },
        orderBy: { code: 'asc' },
      });
      if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');
      return branch;
    }
    const manager = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        managedBranch: true,
        staffProfile: { select: { branchId: true } },
      },
    });
    if (
      !manager?.managedBranch ||
      manager.managedBranch.id !== manager.staffProfile?.branchId
    ) {
      throw new BadRequestException(
        'Tài khoản chưa được phân công quản lý chi nhánh',
      );
    }
    if (requested && requested !== manager.managedBranch.id) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }
    return manager.managedBranch;
  }

  async createIngredient(dto: CreateIngredientDto, actorUserId?: number) {
    const name = dto.name.trim();
    const exists = await this.prisma.ingredient.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (exists) throw new ConflictException('Nguyên liệu đã tồn tại');
    const ingredient = await this.prisma.ingredient.create({
      data: { name, unit: dto.unit },
    });
    if (actorUserId) {
      await writeAuditLog(this.prisma, {
        actorId: actorUserId,
        module: 'INVENTORY',
        action: 'CREATE_INGREDIENT',
        entityType: 'Ingredient',
        entityId: ingredient.id,
        description: `Thêm nguyên liệu ${ingredient.name}`,
        afterData: ingredient,
      });
    }
    return ingredient;
  }

  async getOverview(userId: number, role: string, requestedBranchId?: number) {
    const branch = await this.getScopedBranch(userId, role, requestedBranchId);
    const [branches, ingredients, stocks, movements] = await Promise.all([
      role === 'ADMIN'
        ? this.prisma.storeBranch.findMany({ orderBy: { code: 'asc' } })
        : Promise.resolve([branch]),
      this.prisma.ingredient.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.inventoryStock.findMany({
        where: { branchId: branch.id },
        include: { ingredient: true },
      }),
      this.prisma.inventoryMovement.findMany({
        where: { branchId: branch.id },
        include: {
          ingredient: true,
          actor: { select: { id: true, email: true, ...personProfileSelect } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
    const stockByIngredient = new Map(
      stocks.map((stock) => [stock.ingredientId, stock]),
    );
    const rows = ingredients.map((ingredient) => {
      const stock = stockByIngredient.get(ingredient.id);
      const quantity = stock ? this.number(stock.quantity) : 0;
      const reservedQuantity = stock ? this.number(stock.reservedQuantity) : 0;
      const minimumLevel = stock ? this.number(stock.minimumLevel) : 0;
      return {
        ingredient,
        isConfigured: Boolean(stock),
        stockId: stock?.id ?? null,
        quantity,
        reservedQuantity,
        availableQuantity: Math.max(0, quantity - reservedQuantity),
        minimumLevel,
        isLow: Boolean(stock) && quantity - reservedQuantity <= minimumLevel,
        updatedAt: stock?.updatedAt ?? null,
      };
    });
    return {
      selectedBranch: branch,
      branches,
      rows,
      lowStockCount: rows.filter((row) => row.isLow).length,
      movements: movements.map(({ actor, ...movement }) => ({
        ...movement,
        actor: actor ? flattenPersonProfile(actor) : null,
      })),
    };
  }

  async getRecipes() {
    const [ingredients, products, toppings] = await Promise.all([
      this.prisma.ingredient.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.findMany({
        orderBy: { name: 'asc' },
        include: {
          variants: {
            orderBy: { price: 'asc' },
            include: { recipeIngredients: { include: { ingredient: true } } },
          },
        },
      }),
      this.prisma.topping.findMany({
        orderBy: { name: 'asc' },
        include: { recipeIngredients: { include: { ingredient: true } } },
      }),
    ]);
    return { ingredients, products, toppings };
  }

  private validateRecipe(dto: UpdateRecipeDto) {
    const ids = dto.items.map((item) => item.ingredientId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Một nguyên liệu không được lặp lại trong công thức',
      );
    }
    return dto.items;
  }

  async updateVariantRecipe(
    variantId: number,
    dto: UpdateRecipeDto,
    actorUserId?: number,
  ) {
    const items = this.validateRecipe(dto);
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { recipeIngredients: true },
    });
    if (!variant) throw new NotFoundException('Không tìm thấy size sản phẩm');
    await this.assertIngredients(items.map((item) => item.ingredientId));
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.variantRecipeIngredient.deleteMany({ where: { variantId } });
      if (items.length) {
        await tx.variantRecipeIngredient.createMany({
          data: items.map((item) => ({ variantId, ...item })),
        });
      }
      return tx.productVariant.findUnique({
        where: { id: variantId },
        include: { recipeIngredients: { include: { ingredient: true } } },
      });
    });
    if (actorUserId) {
      await writeAuditLog(this.prisma, {
        actorId: actorUserId,
        module: 'INVENTORY',
        action: 'UPDATE_VARIANT_RECIPE',
        entityType: 'ProductVariant',
        entityId: variantId,
        description: `Cập nhật công thức size sản phẩm #${variantId}`,
        beforeData: variant.recipeIngredients,
        afterData: updated?.recipeIngredients ?? [],
      });
    }
    return updated;
  }

  async updateToppingRecipe(
    toppingId: number,
    dto: UpdateRecipeDto,
    actorUserId?: number,
  ) {
    const items = this.validateRecipe(dto);
    const topping = await this.prisma.topping.findUnique({
      where: { id: toppingId },
      include: { recipeIngredients: true },
    });
    if (!topping) throw new NotFoundException('Không tìm thấy topping');
    await this.assertIngredients(items.map((item) => item.ingredientId));
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.toppingRecipeIngredient.deleteMany({ where: { toppingId } });
      if (items.length) {
        await tx.toppingRecipeIngredient.createMany({
          data: items.map((item) => ({ toppingId, ...item })),
        });
      }
      return tx.topping.findUnique({
        where: { id: toppingId },
        include: { recipeIngredients: { include: { ingredient: true } } },
      });
    });
    if (actorUserId) {
      await writeAuditLog(this.prisma, {
        actorId: actorUserId,
        module: 'INVENTORY',
        action: 'UPDATE_TOPPING_RECIPE',
        entityType: 'Topping',
        entityId: toppingId,
        description: `Cập nhật công thức topping ${topping.name}`,
        beforeData: topping.recipeIngredients,
        afterData: updated?.recipeIngredients ?? [],
      });
    }
    return updated;
  }

  private async assertIngredients(ids: number[]) {
    if (!ids.length) return;
    const count = await this.prisma.ingredient.count({
      where: { id: { in: ids }, isActive: true },
    });
    if (count !== ids.length)
      throw new BadRequestException('Công thức có nguyên liệu không hợp lệ');
  }

  // Tồn thực tế chỉ thay đổi qua phiếu nhập hoặc tiêu hao theo đơn.
  // Màn hình tồn kho chỉ được phép cấu hình ngưỡng cảnh báo.
  async updateMinimumLevel(userId: number, role: string, dto: AdjustStockDto) {
    await this.getScopedBranch(userId, role, dto.branchId);
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id: dto.ingredientId, isActive: true },
    });
    if (!ingredient) throw new NotFoundException('Không tìm thấy nguyên liệu');
    let beforeData: Record<string, unknown> | undefined;
    const stock = await this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryStock.findUnique({
        where: {
          branchId_ingredientId: {
            branchId: dto.branchId,
            ingredientId: dto.ingredientId,
          },
        },
      });
      beforeData = current
        ? {
            ingredientId: current.ingredientId,
            minimumLevel: current.minimumLevel,
            quantity: current.quantity,
            reservedQuantity: current.reservedQuantity,
          }
        : {
            ingredientId: dto.ingredientId,
            minimumLevel: 0,
            quantity: 0,
            reservedQuantity: 0,
          };
      const quantity = current ? this.number(current.quantity) : 0;
      const reserved = current ? this.number(current.reservedQuantity) : 0;
      const stock = await tx.inventoryStock.upsert({
        where: {
          branchId_ingredientId: {
            branchId: dto.branchId,
            ingredientId: dto.ingredientId,
          },
        },
        create: {
          branchId: dto.branchId,
          ingredientId: dto.ingredientId,
          quantity: 0,
          minimumLevel: dto.minimumLevel,
        },
        update: {
          minimumLevel: dto.minimumLevel,
          lowStockNotifiedAt:
            quantity - reserved > dto.minimumLevel
              ? null
              : current?.lowStockNotifiedAt,
        },
      });
      await this.syncLowStockNotification(tx, stock.id);
      return stock;
    });
    await writeAuditLog(this.prisma, {
      actorId: userId,
      branchId: dto.branchId,
      module: 'INVENTORY',
      action: 'UPDATE_MINIMUM_LEVEL',
      entityType: 'InventoryStock',
      entityId: stock.id,
      description: `Cập nhật ngưỡng cảnh báo của ${ingredient.name}`,
      beforeData,
      afterData: {
        ingredientId: dto.ingredientId,
        minimumLevel: dto.minimumLevel,
        quantity: stock.quantity,
        reservedQuantity: stock.reservedQuantity,
      },
    });
    return stock;
  }

  async reserveForOrder(
    tx: Tx,
    orderId: number,
    branchId: number,
    actorId?: number,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            variant: {
              include: { recipeIngredients: { include: { ingredient: true } } },
            },
            toppings: true,
          },
        },
      },
    });
    if (!order || order.inventoryState !== 'NOT_TRACKED') {
      return order?.inventoryState ?? ('NOT_TRACKED' as const);
    }
    const toppingIds = [
      ...new Set(
        order.items.flatMap((item) =>
          item.toppings.map((top) => top.toppingId),
        ),
      ),
    ];
    const toppingRecipes = toppingIds.length
      ? await tx.toppingRecipeIngredient.findMany({
          where: { toppingId: { in: toppingIds } },
          include: { ingredient: true, topping: { select: { name: true } } },
        })
      : [];
    const recipesByTopping = new Map<number, typeof toppingRecipes>();
    for (const recipe of toppingRecipes) {
      const current = recipesByTopping.get(recipe.toppingId) ?? [];
      current.push(recipe);
      recipesByTopping.set(recipe.toppingId, current);
    }
    const configuredSourceCount =
      order.items.filter((item) => item.variant.recipeIngredients.length > 0)
        .length +
      toppingIds.filter((id) => (recipesByTopping.get(id)?.length ?? 0) > 0)
        .length;
    if (configuredSourceCount === 0) return 'NOT_TRACKED' as const;
    const missing: string[] = [];
    const snapshots: Array<{
      orderItemId: number;
      ingredientId: number;
      ingredientName: string;
      unit: IngredientUnit;
      sourceName: string;
      quantityPerItem: number;
      totalQuantity: number;
    }> = [];
    for (const item of order.items) {
      if (!item.variant.recipeIngredients.length)
        missing.push(`${item.productName} size ${item.size}`);
      for (const recipe of item.variant.recipeIngredients) {
        const quantity = this.number(recipe.quantity);
        snapshots.push({
          orderItemId: item.id,
          ingredientId: recipe.ingredientId,
          ingredientName: recipe.ingredient.name,
          unit: recipe.ingredient.unit,
          sourceName: `${item.productName} size ${item.size}`,
          quantityPerItem: quantity,
          totalQuantity: quantity * item.quantity,
        });
      }
      for (const selected of item.toppings) {
        const recipes = recipesByTopping.get(selected.toppingId) ?? [];
        if (!recipes.length) missing.push(`Topping ${selected.toppingName}`);
        for (const recipe of recipes) {
          const quantity = this.number(recipe.quantity);
          snapshots.push({
            orderItemId: item.id,
            ingredientId: recipe.ingredientId,
            ingredientName: recipe.ingredient.name,
            unit: recipe.ingredient.unit,
            sourceName: `Topping ${selected.toppingName}`,
            quantityPerItem: quantity,
            totalQuantity: quantity * item.quantity,
          });
        }
      }
    }
    if (missing.length) {
      throw new BadRequestException(
        `Chưa thiết lập công thức kho cho: ${[...new Set(missing)].join(', ')}`,
      );
    }
    const required = new Map<number, number>();
    for (const snapshot of snapshots) {
      required.set(
        snapshot.ingredientId,
        (required.get(snapshot.ingredientId) ?? 0) + snapshot.totalQuantity,
      );
    }
    for (const [ingredientId, quantity] of required) {
      const stock = await tx.inventoryStock.findUnique({
        where: { branchId_ingredientId: { branchId, ingredientId } },
        include: { ingredient: true },
      });
      if (
        !stock ||
        this.number(stock.quantity) - this.number(stock.reservedQuantity) <
          quantity
      ) {
        throw new BadRequestException(
          `Chi nhánh không đủ ${stock?.ingredient.name ?? 'nguyên liệu'} để nhận đơn`,
        );
      }
      const updated = await tx.inventoryStock.updateMany({
        where: {
          id: stock.id,
          quantity: stock.quantity,
          reservedQuantity: stock.reservedQuantity,
        },
        data: { reservedQuantity: { increment: quantity } },
      });
      if (updated.count !== 1)
        throw new BadRequestException(
          'Tồn kho vừa thay đổi, vui lòng đặt lại đơn',
        );
      await this.syncLowStockNotification(tx, stock.id);
    }
    await tx.orderItemRecipeIngredient.createMany({ data: snapshots });
    for (const [ingredientId, quantity] of required) {
      const reservation = await tx.orderIngredientReservation.create({
        data: { orderId, ingredientId, quantity },
      });
      const stock = await tx.inventoryStock.findUniqueOrThrow({
        where: { branchId_ingredientId: { branchId, ingredientId } },
      });
      await this.reserveLotsFefo(
        tx,
        reservation.id,
        orderId,
        branchId,
        ingredientId,
        quantity,
        stock,
        actorId,
      );
    }
    await tx.order.update({
      where: { id: orderId },
      data: { inventoryState: 'RESERVED' },
    });
    return 'RESERVED' as const;
  }

  async consumeOrder(
    tx: Tx,
    orderId: number,
    branchId: number,
    actorId?: number,
  ) {
    const reservations = await tx.orderIngredientReservation.findMany({
      where: { orderId, state: 'RESERVED' },
      include: { lotAllocations: { where: { state: 'RESERVED' } } },
    });
    if (!reservations.length) return;
    for (const reservation of reservations) {
      const claimedReservation = await tx.orderIngredientReservation.updateMany(
        {
          where: { id: reservation.id, state: 'RESERVED' },
          data: { state: 'CONSUMED' },
        },
      );
      if (claimedReservation.count !== 1) {
        throw new BadRequestException(
          'Đơn vừa được xử lý kho, vui lòng tải lại',
        );
      }
      const quantity = this.number(reservation.quantity);
      const allocated = reservation.lotAllocations.reduce(
        (sum, item) => sum + this.number(item.quantity),
        0,
      );
      if (Math.abs(allocated - quantity) > 0.0005) {
        throw new BadRequestException(
          'Dữ liệu phân bổ lô của đơn không hợp lệ',
        );
      }
      const changed = await tx.inventoryStock.updateMany({
        where: {
          branchId,
          ingredientId: reservation.ingredientId,
          quantity: { gte: quantity },
          reservedQuantity: { gte: quantity },
        },
        data: {
          quantity: { decrement: quantity },
          reservedQuantity: { decrement: quantity },
        },
      });
      if (changed.count !== 1)
        throw new BadRequestException(
          'Tồn kho không còn khớp với lượng đã giữ',
        );
      const stock = await tx.inventoryStock.findUniqueOrThrow({
        where: {
          branchId_ingredientId: {
            branchId,
            ingredientId: reservation.ingredientId,
          },
        },
      });
      for (const allocation of reservation.lotAllocations) {
        const lot = await tx.inventoryLot.findUniqueOrThrow({
          where: { id: allocation.lotId },
        });
        const lotQuantity = this.number(allocation.quantity);
        const nextQuantity = this.number(lot.quantity) - lotQuantity;
        const lotChanged = await tx.inventoryLot.updateMany({
          where: {
            id: lot.id,
            quantity: lot.quantity,
            reservedQuantity: lot.reservedQuantity,
          },
          data: {
            quantity: { decrement: lotQuantity },
            reservedQuantity: { decrement: lotQuantity },
            status: nextQuantity <= 0.0005 ? 'DEPLETED' : lot.status,
          },
        });
        if (lotChanged.count !== 1) {
          throw new BadRequestException(
            'Số dư lô không còn khớp với lượng đã giữ',
          );
        }
        await tx.orderIngredientLotAllocation.update({
          where: { id: allocation.id },
          data: { state: 'CONSUMED' },
        });
        await tx.inventoryMovement.create({
          data: {
            branchId,
            ingredientId: reservation.ingredientId,
            lotId: lot.id,
            orderId,
            actorId,
            type: 'CONSUME',
            quantityDelta: -lotQuantity,
            reservedDelta: -lotQuantity,
            quantityAfter: stock.quantity,
            reservedAfter: stock.reservedQuantity,
            note: `Xuất lô ${lot.code} pha chế đơn #${orderId}`,
          },
        });
      }
      await this.syncLowStockNotification(tx, stock.id);
    }
    await tx.order.update({
      where: { id: orderId },
      data: { inventoryState: 'CONSUMED' },
    });
  }

  async releaseOrder(
    tx: Tx,
    orderId: number,
    branchId: number,
    actorId?: number,
  ) {
    const reservations = await tx.orderIngredientReservation.findMany({
      where: { orderId, state: 'RESERVED' },
      include: { lotAllocations: { where: { state: 'RESERVED' } } },
    });
    for (const reservation of reservations) {
      const claimedReservation = await tx.orderIngredientReservation.updateMany(
        {
          where: { id: reservation.id, state: 'RESERVED' },
          data: { state: 'RELEASED' },
        },
      );
      if (claimedReservation.count !== 1) {
        throw new BadRequestException(
          'Đơn vừa được xử lý kho, vui lòng tải lại',
        );
      }
      const quantity = this.number(reservation.quantity);
      const changed = await tx.inventoryStock.updateMany({
        where: {
          branchId,
          ingredientId: reservation.ingredientId,
          reservedQuantity: { gte: quantity },
        },
        data: { reservedQuantity: { decrement: quantity } },
      });
      if (changed.count !== 1)
        throw new BadRequestException(
          'Không thể hoàn lượng nguyên liệu đã giữ',
        );
      const stock = await tx.inventoryStock.findUniqueOrThrow({
        where: {
          branchId_ingredientId: {
            branchId,
            ingredientId: reservation.ingredientId,
          },
        },
      });
      const allocated = reservation.lotAllocations.reduce(
        (sum, item) => sum + this.number(item.quantity),
        0,
      );
      if (Math.abs(allocated - quantity) > 0.0005) {
        throw new BadRequestException(
          'Dữ liệu phân bổ lô của đơn không hợp lệ',
        );
      }
      for (const allocation of reservation.lotAllocations) {
        const lot = await tx.inventoryLot.findUniqueOrThrow({
          where: { id: allocation.lotId },
        });
        const lotQuantity = this.number(allocation.quantity);
        const lotChanged = await tx.inventoryLot.updateMany({
          where: { id: lot.id, reservedQuantity: { gte: lotQuantity } },
          data: { reservedQuantity: { decrement: lotQuantity } },
        });
        if (lotChanged.count !== 1)
          throw new BadRequestException('Không thể hoàn lượng giữ của lô');
        await tx.orderIngredientLotAllocation.update({
          where: { id: allocation.id },
          data: { state: 'RELEASED' },
        });
        await tx.inventoryMovement.create({
          data: {
            branchId,
            ingredientId: reservation.ingredientId,
            lotId: lot.id,
            orderId,
            actorId,
            type: 'RELEASE',
            quantityDelta: 0,
            reservedDelta: -lotQuantity,
            quantityAfter: stock.quantity,
            reservedAfter: stock.reservedQuantity,
            note: `Hoàn lượng giữ lô ${lot.code} của đơn #${orderId}`,
          },
        });
      }
      await this.syncLowStockNotification(tx, stock.id);
    }
    if (reservations.length) {
      await tx.order.update({
        where: { id: orderId },
        data: { inventoryState: 'RELEASED' },
      });
    }
  }

  private async reserveLotsFefo(
    tx: Tx,
    reservationId: number,
    orderId: number,
    branchId: number,
    ingredientId: number,
    requiredQuantity: number,
    stock: {
      quantity: { toString(): string };
      reservedQuantity: { toString(): string };
    },
    actorId?: number,
  ) {
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const today = new Date(`${todayKey}T00:00:00+07:00`);
    const lots = await tx.inventoryLot.findMany({
      where: {
        branchId,
        ingredientId,
        status: 'ACTIVE',
        quantity: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
      },
      orderBy: [
        { expiresAt: { sort: 'asc', nulls: 'last' } },
        { receivedAt: 'asc' },
        { id: 'asc' },
      ],
    });
    let remaining = requiredQuantity;
    for (const lot of lots) {
      if (remaining <= 0.0005) break;
      const available =
        this.number(lot.quantity) - this.number(lot.reservedQuantity);
      if (available <= 0.0005) continue;
      const quantity = Math.min(remaining, available);
      const claimed = await tx.inventoryLot.updateMany({
        where: {
          id: lot.id,
          quantity: lot.quantity,
          reservedQuantity: lot.reservedQuantity,
          status: 'ACTIVE',
        },
        data: { reservedQuantity: { increment: quantity } },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Lô nguyên liệu vừa thay đổi, vui lòng đặt lại đơn',
        );
      }
      const unitCost = this.number(lot.unitCost);
      await tx.orderIngredientLotAllocation.create({
        data: {
          orderId,
          reservationId,
          lotId: lot.id,
          quantity,
          unitCost,
          costAmount: quantity * unitCost,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          branchId,
          ingredientId,
          lotId: lot.id,
          orderId,
          actorId,
          type: 'RESERVE',
          quantityDelta: 0,
          reservedDelta: quantity,
          quantityAfter: this.number(stock.quantity),
          reservedAfter: this.number(stock.reservedQuantity),
          note: `Giữ lô ${lot.code} cho đơn #${orderId} theo FEFO`,
        },
      });
      remaining -= quantity;
    }
    if (remaining > 0.0005) {
      throw new BadRequestException(
        'Tồn theo lô không đủ hoặc các lô còn lại đã hết hạn',
      );
    }
  }

  async applyInventoryCountToLots(
    tx: Tx,
    branchId: number,
    ingredientId: number,
    inventoryCountId: number,
    difference: number,
  ) {
    if (difference > 0) {
      const latest = await tx.inventoryLot.findFirst({
        where: { branchId, ingredientId },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        select: { unitCost: true },
      });
      const lot = await tx.inventoryLot.create({
        data: {
          code: `LOT-COUNT-${inventoryCountId}-${ingredientId}`,
          batchCode: `KIỂM-KÊ-${inventoryCountId}`,
          branchId,
          ingredientId,
          receivedAt: new Date(),
          initialQuantity: difference,
          quantity: difference,
          unitCost: latest?.unitCost ?? 0,
          note: 'Lô chênh lệch tăng được tạo khi duyệt phiếu kiểm kê.',
        },
      });
      return [{ lotId: lot.id, quantityDelta: difference }];
    }
    let remaining = Math.abs(difference);
    const lots = await tx.inventoryLot.findMany({
      where: { branchId, ingredientId, status: 'ACTIVE', quantity: { gt: 0 } },
      orderBy: [
        { expiresAt: { sort: 'asc', nulls: 'last' } },
        { receivedAt: 'asc' },
        { id: 'asc' },
      ],
    });
    const changes: Array<{ lotId: number; quantityDelta: number }> = [];
    for (const lot of lots) {
      if (remaining <= 0.0005) break;
      const available =
        this.number(lot.quantity) - this.number(lot.reservedQuantity);
      if (available <= 0.0005) continue;
      const quantity = Math.min(remaining, available);
      const nextQuantity = this.number(lot.quantity) - quantity;
      const claimed = await tx.inventoryLot.updateMany({
        where: {
          id: lot.id,
          quantity: lot.quantity,
          reservedQuantity: lot.reservedQuantity,
        },
        data: {
          quantity: { decrement: quantity },
          status: nextQuantity <= 0.0005 ? 'DEPLETED' : lot.status,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Lô vừa thay đổi trong lúc duyệt kiểm kê',
        );
      }
      changes.push({ lotId: lot.id, quantityDelta: -quantity });
      remaining -= quantity;
    }
    if (remaining > 0.0005) {
      throw new BadRequestException(
        'Tổng các lô không đủ để áp dụng phần thiếu kiểm kê',
      );
    }
    return changes;
  }

  async syncLowStockNotification(tx: Tx, stockId: number) {
    const stock = await tx.inventoryStock.findUnique({
      where: { id: stockId },
      include: { ingredient: true, branch: true },
    });
    if (!stock) return;
    const available =
      this.number(stock.quantity) - this.number(stock.reservedQuantity);
    const minimum = this.number(stock.minimumLevel);
    if (available > minimum) {
      if (stock.lowStockNotifiedAt) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: { lowStockNotifiedAt: null },
        });
      }
      return;
    }
    if (stock.lowStockNotifiedAt) return;
    const admins = await tx.user.findMany({
      where: { isActive: true, role: { name: 'ADMIN' } },
      select: { id: true },
    });
    const userIds = [
      ...new Set([
        ...admins.map((admin) => admin.id),
        ...(stock.branch.managerId ? [stock.branch.managerId] : []),
      ]),
    ];
    if (userIds.length) {
      await tx.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type: 'LOW_STOCK',
          title: `Sắp hết ${stock.ingredient.name}`,
          message: `${stock.branch.code} chỉ còn ${Math.max(0, available)} ${stock.ingredient.unit}; mức cảnh báo là ${minimum}.`,
        })),
      });
    }
    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: { lowStockNotifiedAt: new Date() },
    });
  }
}
