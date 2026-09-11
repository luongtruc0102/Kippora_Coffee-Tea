import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],

  // Cho phép module khác sử dụng ProductsService khi cần
  exports: [ProductsService],
})
export class ProductsModule {}
