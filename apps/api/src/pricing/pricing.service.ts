import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyProductPriceDto } from './dto/apply-product-price.dto';
import { ListPriceHistoryDto } from './dto/list-price-history.dto';
import { PricingRecommendationsQueryDto } from './dto/pricing-recommendations-query.dto';
import { UpdatePricingSettingsDto } from './dto/update-pricing-settings.dto';

const SETTINGS_ID = 1;

type CostIngredient = {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantity: number;
  availableQuantity: number;
  unitCost: number | null;
  costAmount: number;
  isEstimated: boolean;
  isShort: boolean;
};

type BranchRecipeCost = {
  branchId: number;
  branchCode: string;
  branchName: string;
  recipeCost: number;
  missingCost: boolean;
  hasEstimatedCost: boolean;
  hasStockShortage: boolean;
  ingredients: CostIngredient[];
};

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private number(value: { toString(): string } | number | null | undefined) {
    return value === null || value === undefined ? 0 : Number(value.toString());
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private percent(profit: number, revenue: number) {
    return revenue > 0 ? this.round((profit / revenue) * 100) : 0;
  }

  private async getSettingsRecord() {
    return this.prisma.storeSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  private serializeSettings(
    settings: Awaited<ReturnType<PricingService['getSettingsRecord']>>,
  ) {
    return {
      targetMarginPercent: this.number(settings.pricingTargetMarginPercent),
      costIncreaseAlertPercent: this.number(settings.pricingCostAlertPercent),
      roundingStep: settings.pricingRoundingStep,
    };
  }

  async getRecommendations(query: PricingRecommendationsQueryDto) {
    const settingsRecord = await this.getSettingsRecord();
    const settings = this.serializeSettings(settingsRecord);
    const branches = await this.prisma.storeBranch.findMany({
      where: {
        isActive: true,
        ...(query.branchId ? { id: query.branchId } : {}),
      },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    if (query.branchId && branches.length === 0) {
      throw new NotFoundException('Không tìm thấy chi nhánh đang hoạt động');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      select: {
        id: true,
        productId: true,
        size: true,
        price: true,
        product: {
          select: {
            name: true,
            category: { select: { id: true, name: true } },
          },
        },
        recipeIngredients: {
          select: {
            ingredientId: true,
            quantity: true,
            ingredient: { select: { name: true, unit: true } },
          },
          orderBy: { ingredientId: 'asc' },
        },
      },
      orderBy: [{ product: { name: 'asc' } }, { price: 'asc' }, { id: 'asc' }],
    });

    const branchIds = branches.map((branch) => branch.id);
    const ingredientIds = [
      ...new Set(
        variants.flatMap((variant) =>
          variant.recipeIngredients.map((recipe) => recipe.ingredientId),
        ),
      ),
    ];
    const variantIds = variants.map((variant) => variant.id);
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const today = new Date(`${todayKey}T00:00:00+07:00`);
    const recentSalesFrom = new Date(Date.now() - 30 * 86_400_000);

    const [availableLots, pricedLots, priceHistory, recentSales] =
      await Promise.all([
        this.prisma.inventoryLot.findMany({
          where: {
            branchId: { in: branchIds },
            ingredientId: { in: ingredientIds },
            status: 'ACTIVE',
            quantity: { gt: 0 },
            unitCost: { gt: 0 },
            OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
          },
          select: {
            id: true,
            branchId: true,
            ingredientId: true,
            quantity: true,
            reservedQuantity: true,
            unitCost: true,
            expiresAt: true,
            receivedAt: true,
          },
          orderBy: [
            { expiresAt: { sort: 'asc', nulls: 'last' } },
            { receivedAt: 'asc' },
            { id: 'asc' },
          ],
        }),
        this.prisma.inventoryLot.findMany({
          where: {
            branchId: { in: branchIds },
            ingredientId: { in: ingredientIds },
            unitCost: { gt: 0 },
          },
          select: {
            branchId: true,
            ingredientId: true,
            unitCost: true,
            receivedAt: true,
          },
          orderBy: [{ receivedAt: 'desc' }],
        }),
        this.prisma.productPriceHistory.findMany({
          where: {
            variantId: { in: variantIds },
            ...(query.branchId ? { costBasisBranchId: query.branchId } : {}),
          },
          select: { variantId: true, recipeCost: true, createdAt: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.orderItem.groupBy({
          by: ['variantId'],
          where: {
            variantId: { in: variantIds },
            order: {
              ...(query.branchId ? { branchId: query.branchId } : {}),
              payment: {
                is: {
                  status: { in: ['PAID', 'REFUNDED'] },
                  paidAt: { gte: recentSalesFrom },
                },
              },
            },
          },
          _sum: { quantity: true },
        }),
      ]);

    const availableByIngredient = new Map<string, typeof availableLots>();
    for (const lot of availableLots) {
      const key = `${lot.branchId}:${lot.ingredientId}`;
      const current = availableByIngredient.get(key) ?? [];
      current.push(lot);
      availableByIngredient.set(key, current);
    }
    const latestUnitCost = new Map<string, number>();
    for (const lot of pricedLots) {
      const key = `${lot.branchId}:${lot.ingredientId}`;
      if (!latestUnitCost.has(key)) {
        latestUnitCost.set(key, this.number(lot.unitCost));
      }
    }
    const latestHistoryCost = new Map<number, number>();
    for (const history of priceHistory) {
      if (history.variantId && !latestHistoryCost.has(history.variantId)) {
        latestHistoryCost.set(
          history.variantId,
          this.number(history.recipeCost),
        );
      }
    }
    const recentSalesByVariant = new Map(
      recentSales.map((item) => [item.variantId, item._sum.quantity ?? 0]),
    );

    const recommendations = variants.map((variant) => {
      const branchCosts: BranchRecipeCost[] = branches.map((branch) => {
        const ingredients = variant.recipeIngredients.map((recipe) => {
          const requiredQuantity = this.number(recipe.quantity);
          const key = `${branch.id}:${recipe.ingredientId}`;
          const lots = availableByIngredient.get(key) ?? [];
          let remaining = requiredQuantity;
          let availableQuantity = 0;
          let costAmount = 0;
          for (const lot of lots) {
            const available = Math.max(
              0,
              this.number(lot.quantity) - this.number(lot.reservedQuantity),
            );
            availableQuantity += available;
            if (remaining <= 0 || available <= 0) continue;
            const used = Math.min(remaining, available);
            costAmount += used * this.number(lot.unitCost);
            remaining -= used;
          }
          const fallbackCost = latestUnitCost.get(key);
          const isShort = remaining > 0.0005;
          const isEstimated = isShort && fallbackCost !== undefined;
          if (isEstimated) costAmount += remaining * fallbackCost;
          const missingCost = isShort && fallbackCost === undefined;
          return {
            ingredientId: recipe.ingredientId,
            ingredientName: recipe.ingredient.name,
            unit: recipe.ingredient.unit,
            quantity: this.round(requiredQuantity),
            availableQuantity: this.round(availableQuantity),
            unitCost: missingCost
              ? null
              : requiredQuantity > 0
                ? this.round(costAmount / requiredQuantity)
                : 0,
            costAmount: this.round(costAmount),
            isEstimated,
            isShort,
          };
        });
        return {
          branchId: branch.id,
          branchCode: branch.code,
          branchName: branch.name,
          recipeCost: this.round(
            ingredients.reduce((sum, item) => sum + item.costAmount, 0),
          ),
          missingCost:
            !variant.recipeIngredients.length ||
            ingredients.some((item) => item.unitCost === null),
          hasEstimatedCost: ingredients.some((item) => item.isEstimated),
          hasStockShortage: ingredients.some((item) => item.isShort),
          ingredients,
        };
      });
      const costBasis = [...branchCosts].sort(
        (left, right) => right.recipeCost - left.recipeCost,
      )[0] ?? {
        branchId: 0,
        branchCode: '',
        branchName: 'Chưa có chi nhánh',
        recipeCost: 0,
        missingCost: true,
        hasEstimatedCost: false,
        hasStockShortage: false,
        ingredients: [],
      };
      const missingCost = branchCosts.some((item) => item.missingCost);
      const currentPrice = this.number(variant.price);
      const currentMarginPercent = this.percent(
        currentPrice - costBasis.recipeCost,
        currentPrice,
      );
      const suggestedPrice = missingCost
        ? null
        : Math.ceil(
            costBasis.recipeCost /
              (1 - settings.targetMarginPercent / 100) /
              settings.roundingStep,
          ) * settings.roundingStep;
      const previousCost = latestHistoryCost.get(variant.id) ?? null;
      const costIncreasePercent =
        previousCost && previousCost > 0
          ? this.round(
              ((costBasis.recipeCost - previousCost) / previousCost) * 100,
            )
          : null;
      const status = missingCost
        ? ('MISSING_COST' as const)
        : currentPrice <= costBasis.recipeCost
          ? ('PRICE_BELOW_COST' as const)
          : currentMarginPercent < settings.targetMarginPercent
            ? ('BELOW_TARGET' as const)
            : costIncreasePercent !== null &&
                costIncreasePercent >= settings.costIncreaseAlertPercent
              ? ('COST_INCREASE' as const)
              : ('HEALTHY' as const);
      const last30DaysQuantity = recentSalesByVariant.get(variant.id) ?? 0;
      const currentUnitProfit = this.round(currentPrice - costBasis.recipeCost);
      const suggestedUnitProfit =
        suggestedPrice === null
          ? null
          : this.round(suggestedPrice - costBasis.recipeCost);
      return {
        variantId: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        size: variant.size,
        category: variant.product.category,
        currentPrice: this.round(currentPrice),
        recipeCost: costBasis.recipeCost,
        currentMarginPercent,
        suggestedPrice,
        priceDifference:
          suggestedPrice === null
            ? null
            : this.round(suggestedPrice - currentPrice),
        last30DaysQuantity,
        currentUnitProfit,
        suggestedUnitProfit,
        estimatedMonthlyProfitCurrent: this.round(
          currentUnitProfit * last30DaysQuantity,
        ),
        estimatedMonthlyProfitSuggested:
          suggestedUnitProfit === null
            ? null
            : this.round(suggestedUnitProfit * last30DaysQuantity),
        estimatedMonthlyProfitDifference:
          suggestedUnitProfit === null
            ? null
            : this.round(
                (suggestedUnitProfit - currentUnitProfit) * last30DaysQuantity,
              ),
        costIncreasePercent,
        previousRecipeCost: previousCost,
        status,
        costBasisBranch: {
          id: costBasis.branchId,
          code: costBasis.branchCode,
          name: costBasis.branchName,
        },
        hasEstimatedCost: branchCosts.some((item) => item.hasEstimatedCost),
        hasStockShortage: branchCosts.some((item) => item.hasStockShortage),
        ingredients: costBasis.ingredients,
        branchCosts: branchCosts.map((item) => ({
          branchId: item.branchId,
          branchCode: item.branchCode,
          branchName: item.branchName,
          recipeCost: item.recipeCost,
          missingCost: item.missingCost,
          hasEstimatedCost: item.hasEstimatedCost,
          hasStockShortage: item.hasStockShortage,
        })),
      };
    });

    return {
      generatedAt: new Date(),
      scope: query.branchId ? 'BRANCH' : 'CHAIN',
      selectedBranchId: query.branchId ?? null,
      settings,
      branches,
      summary: {
        totalVariants: recommendations.length,
        healthy: recommendations.filter((item) => item.status === 'HEALTHY')
          .length,
        belowTarget: recommendations.filter(
          (item) => item.status === 'BELOW_TARGET',
        ).length,
        belowCost: recommendations.filter(
          (item) => item.status === 'PRICE_BELOW_COST',
        ).length,
        costIncrease: recommendations.filter(
          (item) => item.status === 'COST_INCREASE',
        ).length,
        missingCost: recommendations.filter(
          (item) => item.status === 'MISSING_COST',
        ).length,
      },
      recommendations,
    };
  }

  async updateSettings(actorId: number, dto: UpdatePricingSettingsDto) {
    const before = await this.getSettingsRecord();
    const updated = await this.prisma.storeSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        pricingTargetMarginPercent: dto.targetMarginPercent,
        pricingCostAlertPercent: dto.costIncreaseAlertPercent,
        pricingRoundingStep: dto.roundingStep,
      },
    });
    const serialized = this.serializeSettings(updated);
    await writeAuditLog(this.prisma, {
      actorId,
      module: 'PRICING',
      action: 'UPDATE_POLICY',
      entityType: 'StoreSettings',
      entityId: SETTINGS_ID,
      description: `Cập nhật chính sách định giá: biên mục tiêu ${dto.targetMarginPercent}%`,
      beforeData: this.serializeSettings(before),
      afterData: serialized,
    });
    return serialized;
  }

  async applyPrice(
    actorId: number,
    variantId: number,
    dto: ApplyProductPriceDto,
  ) {
    const report = await this.getRecommendations({ branchId: dto.branchId });
    const recommendation = report.recommendations.find(
      (item) => item.variantId === variantId,
    );
    if (!recommendation) {
      throw new NotFoundException(
        'Không tìm thấy size sản phẩm đang hoạt động',
      );
    }
    if (recommendation.status === 'MISSING_COST') {
      throw new BadRequestException(
        'Chưa đủ giá nguyên liệu để áp dụng giá bán an toàn',
      );
    }
    if (dto.newPrice <= recommendation.recipeCost) {
      throw new BadRequestException(
        'Giá bán mới phải lớn hơn giá vốn công thức hiện tại',
      );
    }
    if (dto.newPrice === recommendation.currentPrice) {
      throw new BadRequestException('Giá bán mới không thay đổi');
    }
    const newMarginPercent = this.percent(
      dto.newPrice - recommendation.recipeCost,
      dto.newPrice,
    );
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: variantId },
        data: { price: dto.newPrice },
      });
      const activeVariants = await tx.productVariant.findMany({
        where: { productId: recommendation.productId, isActive: true },
        select: { price: true },
      });
      const basePrice = Math.min(
        ...activeVariants.map((variant) => this.number(variant.price)),
      );
      await tx.product.update({
        where: { id: recommendation.productId },
        data: { price: basePrice },
      });
      return tx.productPriceHistory.create({
        data: {
          productId: recommendation.productId,
          variantId,
          actorId,
          costBasisBranchId: recommendation.costBasisBranch.id || null,
          productName: recommendation.productName,
          variantSize: recommendation.size,
          oldPrice: recommendation.currentPrice,
          newPrice: dto.newPrice,
          recipeCost: recommendation.recipeCost,
          targetMarginPercent: report.settings.targetMarginPercent,
          costIncreasePercent: recommendation.costIncreasePercent,
          reason: dto.reason.trim(),
        },
      });
    });
    await writeAuditLog(this.prisma, {
      actorId,
      branchId: recommendation.costBasisBranch.id || null,
      module: 'PRICING',
      action: 'APPLY_PRICE',
      entityType: 'ProductVariant',
      entityId: variantId,
      description: `Đổi giá ${recommendation.productName} size ${recommendation.size} từ ${recommendation.currentPrice}đ thành ${dto.newPrice}đ`,
      beforeData: {
        price: recommendation.currentPrice,
        recipeCost: recommendation.recipeCost,
        marginPercent: recommendation.currentMarginPercent,
      },
      afterData: {
        price: dto.newPrice,
        recipeCost: recommendation.recipeCost,
        marginPercent: newMarginPercent,
      },
      metadata: { reason: dto.reason.trim(), historyId: result.id },
    });
    return {
      historyId: result.id,
      variantId,
      productId: recommendation.productId,
      oldPrice: recommendation.currentPrice,
      newPrice: dto.newPrice,
      recipeCost: recommendation.recipeCost,
      newMarginPercent,
    };
  }

  async getHistory(query: ListPriceHistoryDto) {
    const items = await this.prisma.productPriceHistory.findMany({
      where: query.productId ? { productId: query.productId } : undefined,
      include: {
        actor: {
          select: { email: true, profile: { select: { fullName: true } } },
        },
        costBasisBranch: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
    });
    return items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      size: item.variantSize,
      oldPrice: this.number(item.oldPrice),
      newPrice: this.number(item.newPrice),
      recipeCost: this.number(item.recipeCost),
      targetMarginPercent: this.number(item.targetMarginPercent),
      costIncreasePercent:
        item.costIncreasePercent === null
          ? null
          : this.number(item.costIncreasePercent),
      reason: item.reason,
      createdAt: item.createdAt,
      actorName:
        item.actor?.profile?.fullName || item.actor?.email || 'Hệ thống',
      branch: item.costBasisBranch,
    }));
  }
}
