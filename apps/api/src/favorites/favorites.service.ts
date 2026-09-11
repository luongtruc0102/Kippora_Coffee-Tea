import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy các sản phẩm yêu thích còn hoạt động.
   * Trả trực tiếp Product để frontend dùng chung type và card với Menu.
   */
  async findAll(userId: number) {
    const favorites = await this.prisma.productFavorite.findMany({
      where: {
        userId,

        product: {
          isActive: true,

          category: {
            isActive: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },

      select: {
        product: {
          include: {
            category: true,

            toppings: {
              where: {
                topping: {
                  isActive: true,
                },
              },

              include: {
                topping: true,
              },
            },

            variants: {
              where: {
                isActive: true,
              },

              orderBy: {
                price: 'asc',
              },
            },
          },
        },
      },
    });

    return favorites.map((favorite) => favorite.product);
  }

  /**
   * Chỉ trả ID để trang Menu đánh dấu trái tim mà không tải lại Product.
   */
  async findIds(userId: number) {
    const favorites = await this.prisma.productFavorite.findMany({
      where: {
        userId,

        product: {
          isActive: true,

          category: {
            isActive: true,
          },
        },
      },

      select: {
        productId: true,
      },
    });

    return favorites.map((favorite) => favorite.productId);
  }

  /**
   * Upsert giúp request lặp lại vẫn an toàn,
   * không tạo hai bản ghi yêu thích giống nhau.
   */
  async add(userId: number, productId: number) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,

        category: {
          isActive: true,
        },
      },

      select: {
        id: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        'Không tìm thấy sản phẩm hoặc sản phẩm đã ngừng bán',
      );
    }

    await this.prisma.productFavorite.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },

      create: {
        userId,
        productId,
      },

      update: {},
    });

    return {
      productId,
      isFavorite: true,
    };
  }

  /**
   * deleteMany giữ API idempotent:
   * bỏ yêu thích nhiều lần vẫn trả thành công.
   */
  async remove(userId: number, productId: number) {
    await this.prisma.productFavorite.deleteMany({
      where: {
        userId,
        productId,
      },
    });

    return {
      productId,
      isFavorite: false,
    };
  }
}
