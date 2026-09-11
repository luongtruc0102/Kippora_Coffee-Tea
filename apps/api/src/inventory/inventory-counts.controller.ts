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
  CreateInventoryCountDto,
  UpdateInventoryCountDto,
} from './dto/create-inventory-count.dto';
import { ListInventoryCountsDto } from './dto/list-inventory-counts.dto';
import { ReviewInventoryCountDto } from './dto/review-inventory-count.dto';
import { InventoryCountsService } from './inventory-counts.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('inventory/counts')
export class InventoryCountsController {
  constructor(
    private readonly inventoryCountsService: InventoryCountsService,
  ) {}

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListInventoryCountsDto,
  ) {
    return this.inventoryCountsService.findAll(
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
    return this.inventoryCountsService.findOne(
      request.user.sub,
      request.user.role,
      id,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInventoryCountDto,
  ) {
    return this.inventoryCountsService.create(
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
    @Body() dto: UpdateInventoryCountDto,
  ) {
    return this.inventoryCountsService.update(
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
    return this.inventoryCountsService.submit(
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
    @Body() dto: ReviewInventoryCountDto,
  ) {
    return this.inventoryCountsService.approve(request.user.sub, id, dto);
  }

  @Roles('ADMIN')
  @Post(':id/reject')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewInventoryCountDto,
  ) {
    return this.inventoryCountsService.reject(request.user.sub, id, dto);
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inventoryCountsService.cancel(
      request.user.sub,
      request.user.role,
      id,
    );
  }
}
