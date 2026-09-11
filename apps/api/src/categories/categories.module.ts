import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],

  // Cho phép module khác sử dụng CategoriesService nếu cần
  exports: [CategoriesService],
})
export class CategoriesModule {}
