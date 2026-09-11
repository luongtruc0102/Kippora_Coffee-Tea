import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fuzzySearch: FuzzySearchService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    // Kiểm tra tên danh mục đã tồn tại để tránh dữ liệu bị trùng
    const existingCategory = await this.prisma.category.findUnique({
      where: {
        name: createCategoryDto.name,
      },
    });

    if (existingCategory) {
      throw new ConflictException('Tên danh mục đã tồn tại');
    }

    // Tạo danh mục mới trong database
    return this.prisma.category.create({
      data: {
        name: createCategoryDto.name,
        description: createCategoryDto.description,
      },
    });
  }

  async findAll() {
    // API public chỉ trả các danh mục đang hoạt động
    return this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        // Trả thêm số lượng sản phẩm thuộc danh mục
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }

    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    // Đảm bảo danh mục cần sửa thực sự tồn tại
    await this.findOne(id);

    if (updateCategoryDto.name) {
      // Kiểm tra tên mới có bị trùng với danh mục khác hay không
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          name: updateCategoryDto.name,

          // Loại chính danh mục đang được cập nhật ra khỏi kết quả tìm kiếm
          NOT: {
            id,
          },
        },
      });

      if (existingCategory) {
        throw new ConflictException('Tên danh mục đã tồn tại');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async updateStatus(id: number, isActive: boolean) {
    // Kiểm tra danh mục tồn tại trước khi thay đổi trạng thái
    await this.findOne(id);

    // Soft lock: chỉ thay đổi trạng thái, không xóa dữ liệu khỏi database
    return this.prisma.category.update({
      where: { id },
      data: {
        isActive,
      },
    });
  }

  // CategoriesService
  async findAllForAdmin(query = '') {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return this.fuzzySearch.search(categories, query, {
      keys: [
        { name: 'name', weight: 0.75 },
        { name: 'description', weight: 0.25 },
      ],
    });
  }
}
