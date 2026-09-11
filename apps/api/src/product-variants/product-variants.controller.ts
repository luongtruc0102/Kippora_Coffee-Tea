import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ProductVariantsService } from './product-variants.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateProductVariantStatusDto } from './dto/update-product-variant-status.dto';

@Controller()
export class ProductVariantsController {
  constructor(
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  // ADMIN tạo size mới cho một sản phẩm
  @Roles('ADMIN')
  @Post('products/:productId/variants')
  create(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() createDto: CreateProductVariantDto,
  ) {
    return this.productVariantsService.create(productId, createDto);
  }

  // Khách có thể xem các size đang hoạt động của sản phẩm
  @Public()
  @Get('products/:productId/variants')
  findByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.productVariantsService.findByProduct(productId);
  }

  @Public()
  @Get('product-variants/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productVariantsService.findOne(id);
  }

  // ADMIN cập nhật size hoặc giá
  @Roles('ADMIN')
  @Patch('product-variants/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateProductVariantDto,
  ) {
    return this.productVariantsService.update(id, updateDto);
  }

  // ADMIN khóa hoặc mở khóa variant
  @Roles('ADMIN')
  @Patch('product-variants/:id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() statusDto: UpdateProductVariantStatusDto,
  ) {
    return this.productVariantsService.updateStatus(id, statusDto.isActive);
  }

  // ProductVariantsController
  @Roles('ADMIN')
  @Get('products/:productId/variants/admin/all')
  findByProductForAdmin(@Param('productId', ParseIntPipe) productId: number) {
    return this.productVariantsService.findByProductForAdmin(productId);
  }
}
