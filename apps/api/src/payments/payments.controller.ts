import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { PaymentsService } from './payments.service';

interface JwtUser {
  sub: number;
  email: string;
  role: string;
}

interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // User tạo Payment cho Order của chính mình
  @Post('orders/:orderId')
  create(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(
      request.user.sub,
      orderId,
      createPaymentDto,
    );
  }

  // User xem Payment của Order mình đã đặt
  @Get('orders/:orderId')
  findMyPayment(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    return this.paymentsService.findMyPayment(request.user.sub, orderId);
  }

  // ADMIN/STAFF xem toàn bộ thanh toán
  @Roles('ADMIN', 'STAFF')
  @Get('management/all')
  findAll() {
    return this.paymentsService.findAll();
  }

  // ADMIN/STAFF cập nhật trạng thái thanh toán
  @Roles('ADMIN', 'STAFF')
  @Patch('management/:id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePaymentStatusDto: UpdatePaymentStatusDto,
  ) {
    return this.paymentsService.updateStatus(id, updatePaymentStatusDto);
  }
}
