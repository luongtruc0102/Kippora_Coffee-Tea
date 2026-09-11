import { Module } from '@nestjs/common';
import { StaffLeavesController } from './staff-leaves.controller';
import { StaffLeavesService } from './staff-leaves.service';

@Module({
  controllers: [StaffLeavesController],
  providers: [StaffLeavesService],
  exports: [StaffLeavesService],
})
export class StaffLeavesModule {}
