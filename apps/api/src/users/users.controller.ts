import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SearchQueryDto } from '../common/dto/search-query.dto';

import { Roles } from '../common/decorators/roles.decorator';

import { UsersService } from './users.service';

import { CreateStaffDto } from './dto/create-staff.dto';

import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateBranchStaffDto } from './dto/create-branch-staff.dto';
import { UpdateStaffAssignmentDto } from './dto/update-staff-assignment.dto';

interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
  };
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ADMIN xem danh sách tài khoản
  @Roles('ADMIN')
  @Get()
  findAll(@Query() query: SearchQueryDto) {
    return this.usersService.findAll(query.q);
  }

  // ADMIN tạo tài khoản nhân viên
  @Roles('ADMIN')
  @Post('staff')
  createStaff(
    @Body()
    createStaffDto: CreateStaffDto,
  ) {
    return this.usersService.createStaff(createStaffDto);
  }

  // ADMIN đổi chi nhánh và vai trò nhân viên trong cùng một thao tác.
  @Roles('ADMIN')
  @Patch('staff/:id/assignment')
  updateStaffAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStaffAssignmentDto: UpdateStaffAssignmentDto,
  ) {
    return this.usersService.updateStaffAssignment(
      id,
      updateStaffAssignmentDto,
    );
  }

  // Trưởng chi nhánh chỉ xem Staff thuộc đúng chi nhánh mình quản lý.
  @Roles('BRANCH_MANAGER')
  @Get('branch/staff')
  findBranchStaff(
    @Req() request: AuthenticatedRequest,
    @Query() query: SearchQueryDto,
  ) {
    return this.usersService.findBranchStaff(request.user.sub, query.q);
  }

  // branchId được xác định từ tài khoản trưởng chi nhánh, không nhận từ client.
  @Roles('BRANCH_MANAGER')
  @Post('branch/staff')
  createBranchStaff(
    @Req() request: AuthenticatedRequest,
    @Body() createBranchStaffDto: CreateBranchStaffDto,
  ) {
    return this.usersService.createBranchStaff(
      request.user.sub,
      createBranchStaffDto,
    );
  }

  // Nhân viên thường đọc trạng thái ca của chính mình trên giao diện user.
  @Roles('STAFF')
  @Get('me/attendance/current')
  getMyOpenAttendance(@Req() request: AuthenticatedRequest) {
    return this.usersService.getMyOpenAttendance(request.user.sub);
  }

  // Nhân viên tự điểm danh; ca sau đó được trưởng chi nhánh kết thúc.
  @Roles('STAFF')
  @Post('me/attendance/check-in')
  checkInMyAttendance(@Req() request: AuthenticatedRequest) {
    return this.usersService.checkInMyAttendance(request.user.sub);
  }

  // Trưởng chi nhánh xem chấm công hôm nay của nhân viên thuộc chi nhánh mình.
  @Roles('BRANCH_MANAGER')
  @Get('branch/staff/attendance/today')
  getTodayBranchAttendance(@Req() request: AuthenticatedRequest) {
    return this.usersService.getTodayBranchAttendance(request.user.sub);
  }

  // Bắt đầu ca làm cho một Staff trong đúng chi nhánh.
  @Roles('BRANCH_MANAGER')
  @Post('branch/staff/:id/attendance/check-in')
  checkInBranchStaff(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.checkInBranchStaff(request.user.sub, id);
  }

  // Kết thúc ca đang mở và giữ nguyên lịch sử để tính lương sau này.
  @Roles('BRANCH_MANAGER')
  @Patch('branch/staff/:id/attendance/check-out')
  checkOutBranchStaff(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.checkOutBranchStaff(request.user.sub, id);
  }
  // Trưởng chi nhánh chỉ khóa/mở Staff trong chi nhánh của chính mình.

  @Roles('BRANCH_MANAGER')
  @Patch('branch/staff/:id/status')
  updateBranchStaffStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.usersService.updateBranchStaffStatus(
      request.user.sub,
      id,
      updateStatusDto.isActive,
    );
  }
  // ADMIN xem chi tiết một tài khoản
  @Roles('ADMIN')
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.usersService.findOne(id);
  }

  // ADMIN khóa hoặc mở khóa tài khoản
  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    updateStatusDto: UpdateStatusDto,
  ) {
    return this.usersService.updateStatus(id, updateStatusDto.isActive);
  }
}
