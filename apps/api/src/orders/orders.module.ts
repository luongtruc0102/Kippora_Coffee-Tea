import { Module } from '@nestjs/common';
import { VouchersModule } from '../vouchers/vouchers.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    // Cho phép OrdersService sử dụng VouchersService
    VouchersModule,
    StoreSettingsModule,
    InventoryModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
