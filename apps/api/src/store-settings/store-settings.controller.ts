import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateAcceptingOrdersDto } from './dto/update-accepting-orders.dto';
import { UpdateBranchActiveDto } from './dto/update-branch-active.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import { StoreSettingsService } from './store-settings.service';
import { AssignBranchManagerDto } from './dto/assign-branch-manager.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: number };
}

@Controller('store')
export class StoreSettingsController {
  constructor(private readonly storeSettingsService: StoreSettingsService) {}

  // Trang Cửa hàng chỉ hiển thị các chi nhánh đang hoạt động.
  @Public()
  @Get('locations')
  getLocations() {
    return this.storeSettingsService.getLocations();
  }

  // Trạng thái công khai đã kết hợp cấp hệ thống, chi nhánh và giờ hoạt động.
  @Public()
  @Get('status')
  getStatus(
    @Query('branchId', new ParseIntPipe({ optional: true })) branchId?: number,
  ) {
    return this.storeSettingsService.getStatus(branchId);
  }

  @Roles('ADMIN')
  @Get('settings')
  getSettings() {
    return this.storeSettingsService.getSettings();
  }

  @Roles('ADMIN')
  @Patch('settings')
  updateSettings(@Body() updateStoreSettingsDto: UpdateStoreSettingsDto) {
    return this.storeSettingsService.update(updateStoreSettingsDto);
  }

  // Chỉ Admin được đóng/mở nhận đơn toàn hệ thống.
  @Roles('ADMIN')
  @Patch('accepting-orders')
  updateAcceptingOrders(
    @Body() updateAcceptingOrdersDto: UpdateAcceptingOrdersDto,
  ) {
    return this.storeSettingsService.updateAcceptingOrders(
      updateAcceptingOrdersDto,
    );
  }

  // Admin xem danh sách chi nhánh trong hệ thống.
  @Roles('ADMIN')
  @Get('branches')
  getBranches() {
    return this.storeSettingsService.getBranches();
  }

  @Roles('ADMIN')
  @Post('branches')
  createBranch(@Body() createBranchDto: CreateBranchDto) {
    return this.storeSettingsService.createBranch(createBranchDto);
  }

  @Roles('ADMIN')
  @Patch('branches/:id/status')
  updateBranchActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBranchActiveDto: UpdateBranchActiveDto,
  ) {
    return this.storeSettingsService.updateBranchActive(
      id,
      updateBranchActiveDto.isActive,
    );
  }

  @Roles('ADMIN')
  @Patch('branches/:id')
  updateBranch(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBranchDto: UpdateBranchDto,
  ) {
    return this.storeSettingsService.updateBranch(id, updateBranchDto);
  }

  // Staff xem và vận hành trạng thái nhận đơn của chi nhánh hiện tại.
  @Roles('STAFF', 'BRANCH_MANAGER')
  @Get('branch-status')
  getBranchStatus(@Req() request: AuthenticatedRequest) {
    return this.storeSettingsService.getBranchStatus(request.user.sub);
  }

  @Roles('BRANCH_MANAGER')
  @Patch('branch-status')
  updateBranchStatus(
    @Req() request: AuthenticatedRequest,
    @Body() updateAcceptingOrdersDto: UpdateAcceptingOrdersDto,
  ) {
    return this.storeSettingsService.updateBranchStatus(
      request.user.sub,
      updateAcceptingOrdersDto,
    );
  }

  // Admin thăng Staff thành trưởng chi nhánh.
  @Roles('ADMIN')
  @Patch('branches/:id/manager')
  assignBranchManager(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: AssignBranchManagerDto,
  ) {
    return this.storeSettingsService.assignBranchManager(id, dto.userId);
  }

  // Admin hạ trưởng chi nhánh về Staff.
  @Roles('ADMIN')
  @Delete('branches/:id/manager')
  removeBranchManager(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.storeSettingsService.removeBranchManager(id);
  }
}
