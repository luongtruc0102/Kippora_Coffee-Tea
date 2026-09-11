import { Module } from '@nestjs/common';
import { ProductVariantsController } from './product-variants.controller';
import { ProductVariantsService } from './product-variants.service';

@Module({
  controllers: [ProductVariantsController],
  providers: [ProductVariantsService],

  // Cho phép module khác sử dụng ProductVariantsService khi cần
  exports: [ProductVariantsService],
})
export class ProductVariantsModule {}
