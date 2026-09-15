import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { BankReconciliationService } from './bank-reconciliation.service';

@Module({
  controllers: [PaymentsController, BankReconciliationController],
  providers: [PaymentsService, BankReconciliationService],

  // Sau này Order hoặc webhook thanh toán có thể dùng lại
  exports: [PaymentsService, BankReconciliationService],
})
export class PaymentsModule {}
