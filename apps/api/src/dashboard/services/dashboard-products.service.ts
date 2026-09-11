import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardPeriod } from '../dashboard.types';
import { getDashboardPeriodRange } from '../utils/dashboard-period.util';

@Injectable()
export class DashboardProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // Top sản phẩm bán chạy theo số lượng
  async getTopProducts(
    limit = 5,
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);

    const products = await this.prisma.orderItem.groupBy({
      by: ['productId', 'productName'],

      where: {
        order: {
          ...(branchId ? { branchId } : {}),
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },

      _sum: {
        quantity: true,
        lineTotal: true,
      },

      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },

      take: safeLimit,
    });

    // OrderItem lưu snapshot tên sản phẩm, còn ảnh luôn lấy từ sản phẩm hiện tại.
    const productImages = await this.prisma.product.findMany({
      where: {
        id: {
          in: products.map((product) => product.productId),
        },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });
    const imageByProductId = new Map(
      productImages.map((product) => [product.id, product.imageUrl]),
    );

    return products.map((product) => ({
      productId: product.productId,
      productName: product.productName,
      imageUrl: imageByProductId.get(product.productId) ?? null,
      quantitySold: product._sum.quantity ?? 0,
      revenue: Number(product._sum.lineTotal ?? 0),
    }));
  }

  // Top topping được chọn nhiều nhất trong khoảng thời gian
  async getTopToppings(
    limit = 5,
    period: DashboardPeriod = '7D',
    branchId?: number,
    from?: string,
    to?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    const { startDate, endDate } = getDashboardPeriodRange(period, from, to);

    const toppings = await this.prisma.orderItemTopping.groupBy({
      by: ['toppingId', 'toppingName'],

      where: {
        orderItem: {
          order: {
            ...(branchId ? { branchId } : {}),
            status: 'COMPLETED',
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },

      _count: {
        toppingId: true,
      },

      orderBy: {
        _count: {
          toppingId: 'desc',
        },
      },

      take: safeLimit,
    });

    // Bổ sung ảnh hiện tại của topping cho danh sách phổ biến trên dashboard.
    const toppingImages = await this.prisma.topping.findMany({
      where: {
        id: {
          in: toppings.map((topping) => topping.toppingId),
        },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });
    const imageByToppingId = new Map(
      toppingImages.map((topping) => [topping.id, topping.imageUrl]),
    );

    return toppings.map((topping) => ({
      toppingId: topping.toppingId,
      toppingName: topping.toppingName,
      imageUrl: imageByToppingId.get(topping.toppingId) ?? null,
      selectedCount: topping._count.toppingId,
    }));
  }
}
