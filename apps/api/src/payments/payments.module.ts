import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],

  // Sau này Order hoặc webhook thanh toán có thể dùng lại
  exports: [PaymentsService],
})
export class PaymentsModule {}
