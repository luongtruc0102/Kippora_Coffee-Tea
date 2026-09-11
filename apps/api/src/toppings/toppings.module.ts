import { Module } from '@nestjs/common';
import { ToppingsController } from './toppings.controller';
import { ToppingsService } from './toppings.service';

@Module({
  controllers: [ToppingsController],
  providers: [ToppingsService],

  // Cho phép module khác sử dụng ToppingsService khi cần
  exports: [ToppingsService],
})
export class ToppingsModule {}
