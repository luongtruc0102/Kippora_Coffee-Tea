import { Module } from '@nestjs/common';
import { VouchersController } from './vouchers.controller';
import { VouchersService } from './vouchers.service';

@Module({
  controllers: [VouchersController],
  providers: [VouchersService],

  // OrdersService sẽ dùng lại để kiểm tra voucher lúc checkout
  exports: [VouchersService],
})
export class VouchersModule {}
