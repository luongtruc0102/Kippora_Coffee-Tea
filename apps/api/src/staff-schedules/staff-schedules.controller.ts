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
import { Roles } from '../common/decorators/roles.decorator';
import { CreateStaffShiftDto } from './dto/create-staff-shift.dto';
import { AttendancePeriodQueryDto } from './dto/attendance-period-query.dto';
import { ListAttendanceReportDto } from './dto/list-attendance-report.dto';
import { ListStaffSchedulesDto } from './dto/list-staff-schedules.dto';
import { ReopenAttendancePeriodDto } from './dto/reopen-attendance-period.dto';
import { ReviewAttendancePeriodDto } from './dto/review-attendance-period.dto';
import { UpdateStaffAttendanceDto } from './dto/update-staff-attendance.dto';
import { UpdateStaffShiftDto } from './dto/update-staff-shift.dto';
import { UpdateStaffShiftTemplatesDto } from './dto/update-staff-shift-templates.dto';
import { StaffSchedulesService } from './staff-schedules.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('staff-schedules')
export class StaffSchedulesController {
  constructor(private readonly staffSchedulesService: StaffSchedulesService) {}

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('week')
  getWeek(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListStaffSchedulesDto,
  ) {
    return this.staffSchedulesService.getWeek(
      request.user.sub,
      request.user.role,
      query.weekStart,
      query.branchId,
    );
  }

  @Roles('STAFF')
  @Get('me/status')
  getMyStatus(@Req() request: AuthenticatedRequest) {
    return this.staffSchedulesService.getMyStatus(request.user.sub);
  }

  @Roles('STAFF')
  @Get('me/attendance-report')
  getMyAttendanceReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: AttendancePeriodQueryDto,
  ) {
    return this.staffSchedulesService.getMyAttendanceReport(
      request.user.sub,
      query.month,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('attendance-report')
  getAttendanceReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListAttendanceReportDto,
  ) {
    return this.staffSchedulesService.getAttendanceReport(
      request.user.sub,
      request.user.role,
      query.startDate,
      query.endDate,
      query.branchId,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('attendance-period')
  getAttendancePeriod(
    @Req() request: AuthenticatedRequest,
    @Query() query: AttendancePeriodQueryDto,
  ) {
    return this.staffSchedulesService.getAttendancePeriod(
      request.user.sub,
      request.user.role,
      query.month,
      query.branchId,
    );
  }

  @Roles('BRANCH_MANAGER')
  @Post('attendance-period/submit')
  submitAttendancePeriod(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AttendancePeriodQueryDto,
  ) {
    return this.staffSchedulesService.submitAttendancePeriod(
      request.user.sub,
      dto.month,
    );
  }

  @Roles('ADMIN')
  @Patch('attendance-periods/:id/review')
  reviewAttendancePeriod(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewAttendancePeriodDto,
  ) {
    return this.staffSchedulesService.reviewAttendancePeriod(
      request.user.sub,
      id,
      dto,
    );
  }

  @Roles('ADMIN')
  @Patch('attendance-periods/:id/reopen')
  reopenAttendancePeriod(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenAttendancePeriodDto,
  ) {
    return this.staffSchedulesService.reopenAttendancePeriod(
      request.user.sub,
      id,
      dto,
    );
  }

  @Roles('BRANCH_MANAGER')
  @Patch('attendance/:id')
  updateAttendance(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffAttendanceDto,
  ) {
    return this.staffSchedulesService.updateAttendance(
      request.user.sub,
      id,
      dto,
    );
  }

  @Roles('ADMIN')
  @Patch('templates')
  updateTemplates(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStaffShiftTemplatesDto,
  ) {
    return this.staffSchedulesService.updateTemplates(dto, request.user.sub);
  }

  @Roles('BRANCH_MANAGER')
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStaffShiftDto,
  ) {
    return this.staffSchedulesService.create(request.user.sub, dto);
  }

  @Roles('BRANCH_MANAGER')
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffShiftDto,
  ) {
    return this.staffSchedulesService.update(request.user.sub, id, dto);
  }

  @Roles('BRANCH_MANAGER')
  @Delete(':id')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.staffSchedulesService.remove(request.user.sub, id);
  }
}
