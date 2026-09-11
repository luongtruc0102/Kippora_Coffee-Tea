import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { StockReceiptsController } from './stock-receipts.controller';
import { StockReceiptsService } from './stock-receipts.service';
import { InventoryCountsController } from './inventory-counts.controller';
import { InventoryCountsService } from './inventory-counts.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InventoryLotsController } from './inventory-lots.controller';
import { InventoryLotsService } from './inventory-lots.service';

@Module({
  controllers: [
    InventoryController,
    SuppliersController,
    StockReceiptsController,
    InventoryCountsController,
    PurchaseOrdersController,
    InventoryLotsController,
  ],
  providers: [
    InventoryService,
    SuppliersService,
    StockReceiptsService,
    InventoryCountsService,
    PurchaseOrdersService,
    InventoryLotsService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
