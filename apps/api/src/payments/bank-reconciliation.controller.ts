import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BankReconciliationService } from './bank-reconciliation.service';
import { ListBankTransactionsDto } from './dto/list-bank-transactions.dto';
import { ReceiveBankTransactionDto } from './dto/receive-bank-transaction.dto';
import {
  IgnoreBankTransactionDto,
  MatchBankTransactionDto,
} from './dto/resolve-bank-transaction.dto';
import { UpsertBankAccountDto } from './dto/upsert-bank-account.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('payments')
export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  @Get('orders/:orderId/qr')
  getMyQr(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    return this.service.getCustomerInstruction(request.user.sub, orderId);
  }

  @Roles('ADMIN', 'STAFF', 'BRANCH_MANAGER')
  @Get('management/:paymentId/qr')
  getManagedQr(
    @Req() request: AuthenticatedRequest,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.service.getManagedInstruction(
      request.user.sub,
      request.user.role,
      paymentId,
    );
  }

  @Roles('ADMIN')
  @Get('management/bank-accounts/all')
  getAccounts() {
    return this.service.getBankAccounts();
  }

  @Roles('ADMIN')
  @Put('management/bank-accounts/:branchId')
  upsertAccount(
    @Req() request: AuthenticatedRequest,
    @Param('branchId', ParseIntPipe) branchId: number,
    @Body() dto: UpsertBankAccountDto,
  ) {
    return this.service.upsertBankAccount(request.user.sub, branchId, dto);
  }

  @Roles('ADMIN')
  @Get('management/reconciliation/list')
  list(@Query() query: ListBankTransactionsDto) {
    return this.service.listTransactions(query);
  }

  // Dùng để chạy thử luồng trước khi anh kết nối tài khoản doanh nghiệp thật.
  @Roles('ADMIN')
  @Post('management/reconciliation/record')
  record(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReceiveBankTransactionDto,
  ) {
    return this.service.receiveTransaction(dto, request.user.sub, dto);
  }

  @Roles('ADMIN')
  @Post('management/reconciliation/:id/match')
  match(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MatchBankTransactionDto,
  ) {
    return this.service.matchManually(request.user.sub, id, dto);
  }

  @Roles('ADMIN')
  @Post('management/reconciliation/:id/ignore')
  ignore(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IgnoreBankTransactionDto,
  ) {
    return this.service.ignore(request.user.sub, id, dto);
  }

  /**
   * Điểm nhận sao kê chung cho nhà cung cấp. BANK_WEBHOOK_SECRET không được
   * lưu trong database hoặc gửi ra frontend.
   */
  @Public()
  @Post('webhooks/bank-transfer')
  receiveWebhook(
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() dto: ReceiveBankTransactionDto,
  ) {
    this.service.verifyWebhookSecret(secret);
    return this.service.receiveTransaction(dto, null, dto);
  }
}
