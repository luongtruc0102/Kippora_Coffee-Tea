import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

@Injectable()
export class ProductVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  // Tạo variant mới cho sản phẩm
  async create(productId: number, createDto: CreateProductVariantDto) {
    // Chỉ cho tạo variant nếu sản phẩm đang hoạt động
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        'Không tìm thấy sản phẩm hoặc sản phẩm đã bị khóa',
      );
    }

    // Không cho một sản phẩm có nhiều variant cùng size
    const existingVariant = await this.prisma.productVariant.findUnique({
      where: {
        productId_size: {
          productId,
          size: createDto.size,
        },
      },
    });

    if (existingVariant) {
      throw new ConflictException('Size này đã tồn tại trong sản phẩm');
    }

    return this.prisma.productVariant.create({
      data: {
        productId,
        size: createDto.size,
        price: createDto.price,
      },
      include: {
        product: true,
      },
    });
  }

  // API public chỉ trả variant đang hoạt động
  async findByProduct(productId: number) {
    return this.prisma.productVariant.findMany({
      where: {
        productId,
        isActive: true,
        product: {
          isActive: true,
          category: {
            isActive: true,
          },
        },
      },
      orderBy: {
        price: 'asc',
      },
    });
  }

  // Lấy chi tiết một variant đang hoạt động
  async findOne(id: number) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id,
        isActive: true,
        product: {
          isActive: true,
          category: {
            isActive: true,
          },
        },
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Không tìm thấy variant');
    }

    return variant;
  }

  // Dùng nội bộ cho ADMIN để vẫn tìm được variant đã bị khóa
  private async findVariantById(id: number) {
    const variant = await this.prisma.productVariant.findUnique({
      where: {
        id,
      },
    });

    if (!variant) {
      throw new NotFoundException('Không tìm thấy variant');
    }

    return variant;
  }

  // Cập nhật thông tin variant
  async update(id: number, updateDto: UpdateProductVariantDto) {
    const variant = await this.findVariantById(id);

    if (updateDto.size !== undefined) {
      // Không cho đổi sang size đã tồn tại trong cùng sản phẩm
      const existingVariant = await this.prisma.productVariant.findFirst({
        where: {
          productId: variant.productId,
          size: updateDto.size,
          NOT: {
            id,
          },
        },
      });

      if (existingVariant) {
        throw new ConflictException('Size này đã tồn tại trong sản phẩm');
      }
    }

    return this.prisma.productVariant.update({
      where: {
        id,
      },
      data: updateDto,
    });
  }

  // Soft lock hoặc mở lại variant
  async updateStatus(id: number, isActive: boolean) {
    // ADMIN vẫn phải tìm được variant kể cả khi đang bị khóa
    await this.findVariantById(id);

    return this.prisma.productVariant.update({
      where: {
        id,
      },
      data: {
        isActive,
      },
    });
  }

  // ProductVariantsService
  async findByProductForAdmin(productId: number) {
    return this.prisma.productVariant.findMany({
      where: {
        productId,
      },
      orderBy: {
        price: 'asc',
      },
    });
  }
}
