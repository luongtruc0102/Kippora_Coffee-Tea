import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';
import { CreateToppingDto } from './dto/create-topping.dto';
import { UpdateToppingDto } from './dto/update-topping.dto';

@Injectable()
export class ToppingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fuzzySearch: FuzzySearchService,
  ) {}

  // Tạo topping mới
  async create(createToppingDto: CreateToppingDto) {
    // Không cho phép trùng tên topping
    const existingTopping = await this.prisma.topping.findUnique({
      where: {
        name: createToppingDto.name,
      },
    });

    if (existingTopping) {
      throw new ConflictException('Tên topping đã tồn tại');
    }

    return this.prisma.topping.create({
      data: createToppingDto,
    });
  }

  // API public chỉ trả các topping đang hoạt động
  async findAll() {
    return this.prisma.topping.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Lấy chi tiết topping và các sản phẩm đang sử dụng topping đó
  async findOne(id: number) {
    const topping = await this.prisma.topping.findUnique({
      where: {
        id,
      },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!topping) {
      throw new NotFoundException('Không tìm thấy topping');
    }

    return topping;
  }

  // Cập nhật thông tin topping
  async update(id: number, updateToppingDto: UpdateToppingDto) {
    // Đảm bảo topping cần cập nhật tồn tại
    await this.findOne(id);

    if (updateToppingDto.name) {
      // Kiểm tra tên mới có bị trùng với topping khác
      const existingTopping = await this.prisma.topping.findFirst({
        where: {
          name: updateToppingDto.name,

          // Bỏ qua chính topping đang được cập nhật
          NOT: {
            id,
          },
        },
      });

      if (existingTopping) {
        throw new ConflictException('Tên topping đã tồn tại');
      }
    }

    return this.prisma.topping.update({
      where: {
        id,
      },
      data: updateToppingDto,
    });
  }

  // Soft lock topping, không xóa dữ liệu khỏi database
  async updateStatus(id: number, isActive: boolean) {
    // Kiểm tra topping tồn tại trước khi đổi trạng thái
    await this.findOne(id);

    return this.prisma.topping.update({
      where: {
        id,
      },
      data: {
        isActive,
      },
    });
  }

  // ToppingsService
  async findAllForAdmin(query = '') {
    const toppings = await this.prisma.topping.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return this.fuzzySearch.search(toppings, query, {
      keys: [
        { name: 'name', weight: 0.85 },
        {
          name: 'price',
          weight: 0.15,
          getFn: (topping) => topping.price.toString(),
        },
      ],
    });
  }
}
