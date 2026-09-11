import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

// Gom Controller và Service của chức năng Health Check thành một module
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
