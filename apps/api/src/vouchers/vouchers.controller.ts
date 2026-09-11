import {
  Body,
  Controller,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherStatusDto } from './dto/update-voucher-status.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { VouchersService } from './vouchers.service';
import { SearchQueryDto } from '../common/dto/search-query.dto';

interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
  };
}

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  // Chỉ ADMIN được tạo voucher
  @Roles('ADMIN')
  @Post()
  create(@Body() createVoucherDto: CreateVoucherDto) {
    return this.vouchersService.create(createVoucherDto);
  }

  // ADMIN xem toàn bộ voucher để quản lý
  @Roles('ADMIN')
  @Get()
  findAll(@Query() query: SearchQueryDto) {
    return this.vouchersService.findAll(query.q);
  }

  // USER xem các voucher hiện hành và khả năng áp dụng cho đơn đang chọn
  @Roles('USER', 'STAFF')
  @Get('available/checkout')
  findAvailableForCheckout(
    @Req() request: AuthenticatedRequest,
    @Query('subtotal', ParseFloatPipe) subtotal: number,
  ) {
    return this.vouchersService.findAvailableForCheckout(
      request.user.sub,
      subtotal,
    );
  }

  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vouchersService.findOne(id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVoucherDto: UpdateVoucherDto,
  ) {
    return this.vouchersService.update(id, updateVoucherDto);
  }

  // Khóa hoặc mở lại voucher thay vì xóa dữ liệu
  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() statusDto: UpdateVoucherStatusDto,
  ) {
    return this.vouchersService.updateStatus(id, statusDto.isActive);
  }
}
