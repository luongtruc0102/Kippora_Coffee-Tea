import { Module } from '@nestjs/common';
import { ProfitabilityModule } from '../profitability/profitability.module';
import { MonthCloseController } from './month-close.controller';
import { MonthCloseService } from './month-close.service';

@Module({
  imports: [ProfitabilityModule],
  controllers: [MonthCloseController],
  providers: [MonthCloseService],
  exports: [MonthCloseService],
})
export class MonthCloseModule {}
