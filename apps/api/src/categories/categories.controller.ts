import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryStatusDto } from './dto/update-category-status.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Chỉ ADMIN được phép tạo danh mục
  @Roles('ADMIN')
  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  // API public để khách chưa đăng nhập vẫn xem được danh mục
  @Public()
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  // ParseIntPipe đảm bảo id nhận từ URL là số hợp lệ
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  // Chỉ ADMIN được cập nhật thông tin danh mục
  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  // Khóa hoặc mở lại danh mục thay vì xóa trực tiếp
  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryStatusDto: UpdateCategoryStatusDto,
  ) {
    return this.categoriesService.updateStatus(
      id,
      updateCategoryStatusDto.isActive,
    );
  }

  // CategoriesController
  @Roles('ADMIN')
  @Get('admin/all')
  findAllForAdmin(@Query() query: SearchQueryDto) {
    return this.categoriesService.findAllForAdmin(query.q);
  }
}
