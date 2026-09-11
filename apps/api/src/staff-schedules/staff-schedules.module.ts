import { Module } from '@nestjs/common';
import { StaffSchedulesController } from './staff-schedules.controller';
import { StaffSchedulesService } from './staff-schedules.service';

@Module({
  controllers: [StaffSchedulesController],
  providers: [StaffSchedulesService],
  exports: [StaffSchedulesService],
})
export class StaffSchedulesModule {}
