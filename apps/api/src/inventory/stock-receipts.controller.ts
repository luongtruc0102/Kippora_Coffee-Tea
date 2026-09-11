import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateStockReceiptDto,
  UpdateStockReceiptDto,
} from './dto/create-stock-receipt.dto';
import { ListStockReceiptsDto } from './dto/list-stock-receipts.dto';
import { StockReceiptsService } from './stock-receipts.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('inventory/receipts')
export class StockReceiptsController {
  constructor(private readonly stockReceiptsService: StockReceiptsService) {}

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListStockReceiptsDto,
  ) {
    return this.stockReceiptsService.findAll(
      request.user.sub,
      request.user.role,
      query,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.stockReceiptsService.findOne(
      request.user.sub,
      request.user.role,
      id,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStockReceiptDto,
  ) {
    return this.stockReceiptsService.create(
      request.user.sub,
      request.user.role,
      dto,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Put(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockReceiptDto,
  ) {
    return this.stockReceiptsService.update(
      request.user.sub,
      request.user.role,
      id,
      dto,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post(':id/complete')
  complete(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.stockReceiptsService.complete(
      request.user.sub,
      request.user.role,
      id,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.stockReceiptsService.cancel(
      request.user.sub,
      request.user.role,
      id,
    );
  }
}
