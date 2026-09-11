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
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import {
  ListPurchaseOrdersDto,
  PurchaseOrderSuggestionsDto,
} from './dto/list-purchase-orders.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { ReviewPurchaseOrderDto } from './dto/review-purchase-order.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('inventory/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('suggestions')
  suggestions(
    @Req() request: AuthenticatedRequest,
    @Query() query: PurchaseOrderSuggestionsDto,
  ) {
    return this.purchaseOrdersService.getSuggestions(
      request.user.sub,
      request.user.role,
      query.branchId,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListPurchaseOrdersDto,
  ) {
    return this.purchaseOrdersService.findAll(
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
    return this.purchaseOrdersService.findOne(
      request.user.sub,
      request.user.role,
      id,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.create(
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
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(
      request.user.sub,
      request.user.role,
      id,
      dto,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post(':id/submit')
  submit(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.purchaseOrdersService.submit(
      request.user.sub,
      request.user.role,
      id,
    );
  }

  @Roles('ADMIN')
  @Post(':id/approve')
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewPurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.approve(request.user.sub, id, dto);
  }

  @Roles('ADMIN')
  @Post(':id/reject')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewPurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.reject(request.user.sub, id, dto);
  }

  @Roles('ADMIN')
  @Post(':id/mark-ordered')
  markOrdered(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.purchaseOrdersService.markOrdered(request.user.sub, id);
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post(':id/receive')
  receive(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.receive(
      request.user.sub,
      request.user.role,
      id,
      dto,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.purchaseOrdersService.cancel(
      request.user.sub,
      request.user.role,
      id,
    );
  }
}
