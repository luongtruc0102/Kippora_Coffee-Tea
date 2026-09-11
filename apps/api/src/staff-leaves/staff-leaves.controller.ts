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
import { Roles } from '../common/decorators/roles.decorator';
import { CreateStaffLeaveDto } from './dto/create-staff-leave.dto';
import { AssignShiftCoverageDto } from './dto/assign-shift-coverage.dto';
import { ListBranchLeavesDto } from './dto/list-branch-leaves.dto';
import { ReviewStaffLeaveDto } from './dto/review-staff-leave.dto';
import { RespondShiftCoverageDto } from './dto/respond-shift-coverage.dto';
import { SupplementStaffLeaveDto } from './dto/supplement-staff-leave.dto';
import { StaffLeavesService } from './staff-leaves.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('staff-leaves')
export class StaffLeavesController {
  constructor(private readonly staffLeavesService: StaffLeavesService) {}

  @Roles('STAFF')
  @Get('me')
  getMine(@Req() request: AuthenticatedRequest) {
    return this.staffLeavesService.getMine(request.user.sub);
  }

  @Roles('STAFF')
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateStaffLeaveDto,
  ) {
    return this.staffLeavesService.create(request.user.sub, dto);
  }

  @Roles('STAFF')
  @Patch('coverages/:id/respond')
  respondCoverage(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondShiftCoverageDto,
  ) {
    return this.staffLeavesService.respondCoverage(request.user.sub, id, dto);
  }

  @Roles('STAFF')
  @Patch(':id/supplement')
  supplement(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SupplementStaffLeaveDto,
  ) {
    return this.staffLeavesService.supplement(request.user.sub, id, dto);
  }

  @Roles('STAFF')
  @Patch(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.staffLeavesService.cancel(request.user.sub, id);
  }

  @Roles('BRANCH_MANAGER')
  @Get('branch')
  getBranchRequests(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListBranchLeavesDto,
  ) {
    return this.staffLeavesService.getBranchRequests(
      request.user.sub,
      query.status,
    );
  }

  @Roles('BRANCH_MANAGER')
  @Patch(':id/coverage')
  assignCoverage(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignShiftCoverageDto,
  ) {
    return this.staffLeavesService.assignCoverage(request.user.sub, id, dto);
  }

  @Roles('BRANCH_MANAGER')
  @Get(':id/coverage-candidates')
  getCoverageCandidates(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.staffLeavesService.getCoverageCandidates(request.user.sub, id);
  }

  @Roles('BRANCH_MANAGER')
  @Patch(':id/review')
  review(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewStaffLeaveDto,
  ) {
    return this.staffLeavesService.review(request.user.sub, id, dto);
  }
}
