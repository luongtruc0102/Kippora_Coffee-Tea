import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';

import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';

import { CreateOrderReviewDto } from './dto/create-order-review.dto';

import { CreateProductReviewDto } from './dto/create-product-review.dto';

import { UpdateOrderReviewDto } from './dto/update-order-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly fuzzySearch: FuzzySearchService,
  ) {}

  // Chuẩn hóa comment để chuỗi rỗng được lưu thành null.
  private normalizeComment(value?: string) {
    const normalized = value?.trim();

    return normalized || null;
  }

  /**
   * Xác minh từng OrderItem thật sự thuộc đơn hàng.
   * productId luôn do backend lấy từ OrderItem, không tin dữ liệu frontend.
   */
  private prepareProductReviews(
    orderItems: Array<{
      id: number;
      productId: number;
    }>,

    items: CreateProductReviewDto[],
  ) {
    const itemIds = items.map((item) => item.orderItemId);

    // Không cho gửi trùng một OrderItem trong cùng request.
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException(
        'Một món không thể được đánh giá nhiều lần',
      );
    }

    const orderItemMap = new Map(orderItems.map((item) => [item.id, item]));

    return items.map((item) => {
      const orderItem = orderItemMap.get(item.orderItemId);

      if (!orderItem) {
        throw new BadRequestException(
          `Món có ID ${item.orderItemId} không thuộc đơn hàng`,
        );
      }

      return {
        orderItemId: orderItem.id,

        productId: orderItem.productId,

        rating: item.rating,

        comment: this.normalizeComment(item.comment),
      };
    });
  }

  // USER tạo đánh giá cho đơn hàng đã hoàn tất của chính mình.
  async create(userId: number, orderId: number, dto: CreateOrderReviewDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },

      select: {
        id: true,
        status: true,

        review: {
          select: {
            id: true,
          },
        },

        items: {
          select: {
            id: true,
            productId: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (order.status !== 'COMPLETED') {
      throw new BadRequestException('Chỉ có thể đánh giá đơn hàng đã hoàn tất');
    }

    if (order.review) {
      throw new ConflictException('Đơn hàng này đã được đánh giá');
    }

    const productReviews = this.prepareProductReviews(
      order.items,
      dto.items ?? [],
    );

    await this.prisma.orderReview.create({
      data: {
        userId,
        orderId,

        overallRating: dto.overallRating,

        comment: this.normalizeComment(dto.comment),

        productReviews: {
          create: productReviews,
        },
      },
    });

    return this.findMineForOrder(userId, orderId);
  }

  // USER xem đánh giá của mình theo đơn hàng.
  async findMineForOrder(userId: number, orderId: number) {
    const review = await this.prisma.orderReview.findFirst({
      where: {
        userId,
        orderId,
      },

      include: {
        productReviews: {
          orderBy: {
            id: 'asc',
          },

          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },

            orderItem: {
              select: {
                id: true,
                productName: true,
                size: true,
              },
            },
          },
        },

        adminRepliedBy: {
          select: {
            id: true,
            ...personProfileSelect,
          },
        },
      },
    });

    if (!review) return null;
    return {
      ...review,
      adminRepliedBy: review.adminRepliedBy
        ? flattenPersonProfile(review.adminRepliedBy)
        : null,
    };
  }

  // USER sửa đánh giá do chính mình tạo.
  async update(userId: number, reviewId: number, dto: UpdateOrderReviewDto) {
    if (
      dto.overallRating === undefined &&
      dto.comment === undefined &&
      dto.items === undefined
    ) {
      throw new BadRequestException('Không có nội dung đánh giá cần cập nhật');
    }

    const review = await this.prisma.orderReview.findFirst({
      where: {
        id: reviewId,
        userId,
      },

      select: {
        id: true,
        orderId: true,

        order: {
          select: {
            items: {
              select: {
                id: true,
                productId: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    const productReviews =
      dto.items === undefined
        ? undefined
        : this.prepareProductReviews(review.order.items, dto.items);

    await this.prisma.$transaction(async (tx) => {
      // Khi frontend gửi items, thay toàn bộ danh sách đánh giá món.
      if (productReviews !== undefined) {
        await tx.productReview.deleteMany({
          where: {
            orderReviewId: review.id,
          },
        });
      }

      await tx.orderReview.update({
        where: {
          id: review.id,
        },

        data: {
          overallRating: dto.overallRating,

          comment:
            dto.comment === undefined
              ? undefined
              : this.normalizeComment(dto.comment),

          productReviews:
            productReviews === undefined
              ? undefined
              : {
                  create: productReviews,
                },
        },
      });
    });

    return this.findMineForOrder(userId, review.orderId);
  }

  // USER xóa đánh giá của chính mình.
  async remove(userId: number, reviewId: number) {
    const review = await this.prisma.orderReview.findFirst({
      where: {
        id: reviewId,
        userId,
      },

      select: {
        id: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    // ProductReview tự xóa theo onDelete: Cascade.
    await this.prisma.orderReview.delete({
      where: {
        id: review.id,
      },
    });

    return {
      message: 'Đã xóa đánh giá',
    };
  }

  // Lấy đánh giá sản phẩm có lọc sao và phân trang.
  // Summary luôn tính trên toàn bộ đánh giá đang hiển thị.
  async findProductReviews(
    productId: number,
    rating?: number,
    page = 1,
    limit = 10,
  ) {
    const product = await this.prisma.product.findUnique({
      where: {
        id: productId,
      },

      select: {
        id: true,
        name: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    const visibleWhere = {
      productId,

      orderReview: {
        isVisible: true,
      },
    };

    const filteredWhere = {
      ...visibleWhere,

      ...(rating
        ? {
            rating,
          }
        : {}),
    };

    const [reviews, filteredCount, aggregate, ratingGroups] = await Promise.all(
      [
        this.prisma.productReview.findMany({
          where: filteredWhere,

          orderBy: {
            createdAt: 'desc',
          },

          skip: (page - 1) * limit,

          take: limit,

          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            updatedAt: true,

            orderItem: {
              select: {
                size: true,
                productName: true,
              },
            },

            orderReview: {
              select: {
                id: true,
                overallRating: true,
                createdAt: true,

                user: {
                  select: {
                    id: true,
                    ...personProfileSelect,
                  },
                },
              },
            },
          },
        }),

        this.prisma.productReview.count({
          where: filteredWhere,
        }),

        this.prisma.productReview.aggregate({
          where: visibleWhere,

          _avg: {
            rating: true,
          },

          _count: {
            rating: true,
          },
        }),

        this.prisma.productReview.groupBy({
          by: ['rating'],

          where: visibleWhere,

          _count: {
            rating: true,
          },
        }),
      ],
    );

    const distribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    for (const group of ratingGroups) {
      distribution[group.rating] = group._count.rating;
    }

    return {
      product,

      summary: {
        averageRating: Number((aggregate._avg.rating ?? 0).toFixed(1)),

        reviewCount: aggregate._count.rating,

        distribution,
      },

      pagination: {
        page,
        limit,

        total: filteredCount,

        totalPages: Math.ceil(filteredCount / limit),
      },

      reviews: reviews.map(({ orderReview, ...review }) => ({
        ...review,
        orderReview: {
          ...orderReview,
          user: flattenPersonProfile(orderReview.user),
        },
      })),
    };
  }

  // ADMIN xem toàn bộ đánh giá, kể cả đánh giá đang bị ẩn.
  async findAllForAdmin(query = '') {
    const reviews = await this.prisma.orderReview.findMany({
      orderBy: {
        createdAt: 'desc',
      },

      include: {
        user: {
          select: {
            id: true,
            email: true,
            ...personProfileSelect,
          },
        },

        order: {
          select: {
            id: true,
            createdAt: true,
          },
        },

        productReviews: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },

            orderItem: {
              select: {
                id: true,
                productName: true,
                size: true,
              },
            },
          },
        },

        adminRepliedBy: {
          select: {
            id: true,
            ...personProfileSelect,
          },
        },
      },
    });

    const serializedReviews = reviews.map((review) => ({
      ...review,
      user: flattenPersonProfile(review.user),
      adminRepliedBy: review.adminRepliedBy
        ? flattenPersonProfile(review.adminRepliedBy)
        : null,
    }));

    return this.fuzzySearch.search(serializedReviews, query, {
      keys: [
        {
          name: 'id',
          weight: 0.1,
          getFn: (review) => String(review.id),
        },
        {
          name: 'orderId',
          weight: 0.1,
          getFn: (review) => String(review.orderId),
        },
        {
          name: 'user.fullName',
          weight: 0.3,
        },
        {
          name: 'user.email',
          weight: 0.25,
        },
        {
          name: 'comment',
          weight: 0.25,
        },
      ],
    });
  }

  // ADMIN ẩn hoặc hiện lại một đánh giá.
  async updateVisibility(reviewId: number, isVisible: boolean) {
    const review = await this.prisma.orderReview.findUnique({
      where: {
        id: reviewId,
      },

      select: {
        id: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    return this.prisma.orderReview.update({
      where: {
        id: reviewId,
      },

      data: {
        isVisible,
      },

      select: {
        id: true,
        orderId: true,
        isVisible: true,
        updatedAt: true,
      },
    });
  }

  // Lấy điểm trung bình của toàn bộ sản phẩm bằng một query.
  // Menu dùng API này để tránh gọi riêng từng sản phẩm.
  async findProductReviewSummaries() {
    const summaries = await this.prisma.productReview.groupBy({
      by: ['productId'],

      where: {
        orderReview: {
          isVisible: true,
        },
      },

      _avg: {
        rating: true,
      },

      _count: {
        rating: true,
      },
    });

    return summaries.map((summary) => ({
      productId: summary.productId,

      averageRating: Number((summary._avg.rating ?? 0).toFixed(1)),

      reviewCount: summary._count.rating,
    }));
  }

  // ADMIN thêm hoặc sửa phản hồi chính thức của cửa hàng.
  async replyReview(adminId: number, reviewId: number, reply: string) {
    const normalizedReply = reply.trim();

    const review = await this.prisma.orderReview.findUnique({
      where: {
        id: reviewId,
      },

      select: {
        id: true,
        userId: true,
        orderId: true,
        adminReply: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    const isFirstReply = !review.adminReply;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.orderReview.update({
        where: {
          id: review.id,
        },

        data: {
          adminReply: normalizedReply,

          adminRepliedById: adminId,

          adminRepliedAt: new Date(),
        },

        include: {
          adminRepliedBy: {
            select: {
              id: true,
              ...personProfileSelect,
            },
          },
        },
      });

      // Chỉ báo chuông lần đầu cửa hàng phản hồi,
      // tránh spam khi Admin chỉnh sửa nội dung.
      if (isFirstReply) {
        await tx.notification.create({
          data: {
            userId: review.userId,

            orderId: review.orderId,

            type: 'REVIEW_REPLY',

            title: 'Cửa hàng đã phản hồi đánh giá',

            message: `Kippora đã phản hồi đánh giá của bạn cho đơn #${review.orderId}.`,
          },
        });
      }

      return result;
    });

    return {
      ...updated,
      adminRepliedBy: updated.adminRepliedBy
        ? flattenPersonProfile(updated.adminRepliedBy)
        : null,
    };
  }

  // ADMIN xóa phản hồi nhưng giữ nguyên đánh giá của khách.
  async removeReply(reviewId: number) {
    const review = await this.prisma.orderReview.findUnique({
      where: {
        id: reviewId,
      },

      select: {
        id: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    return this.prisma.orderReview.update({
      where: {
        id: review.id,
      },

      data: {
        adminReply: null,
        adminRepliedById: null,
        adminRepliedAt: null,
      },

      select: {
        id: true,
        orderId: true,
        adminReply: true,
        adminRepliedById: true,
        adminRepliedAt: true,
        updatedAt: true,
      },
    });
  }
}
