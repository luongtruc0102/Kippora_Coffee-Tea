import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { DisposeInventoryLotDto } from './dto/dispose-inventory-lot.dto';
import { ListInventoryLotsDto } from './dto/list-inventory-lots.dto';
import { InventoryLotsService } from './inventory-lots.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('inventory/lots')
export class InventoryLotsController {
  constructor(private readonly inventoryLotsService: InventoryLotsService) {}

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get()
  findAll(@Req() request: AuthenticatedRequest, @Query() query: ListInventoryLotsDto) {
    return this.inventoryLotsService.findAll(request.user.sub, request.user.role, query);
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get(':id')
  findOne(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.inventoryLotsService.findOne(request.user.sub, request.user.role, id);
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post(':id/dispose')
  dispose(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DisposeInventoryLotDto,
  ) {
    return this.inventoryLotsService.dispose(request.user.sub, request.user.role, id, dto);
  }
}
