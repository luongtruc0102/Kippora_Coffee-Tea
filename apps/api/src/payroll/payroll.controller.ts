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
import { CreatePayrollAdjustmentDto } from './dto/create-payroll-adjustment.dto';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { MarkPayrollPaidDto } from './dto/mark-payroll-paid.dto';
import { UpdateStaffRateDto } from './dto/update-staff-rate.dto';
import { UpdateRoleRatesDto } from './dto/update-role-rates.dto';
import { PayrollService } from './payroll.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Roles('ADMIN', 'BRANCH_MANAGER')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('me')
  @Roles('STAFF')
  getMine(
    @Req() request: AuthenticatedRequest,
    @Query() query: GeneratePayrollDto,
  ) {
    return this.payrollService.getMine(request.user.sub, query.month);
  }

  @Post('generate')
  generate(
    @Req() request: AuthenticatedRequest,
    @Body() dto: GeneratePayrollDto,
  ) {
    return this.payrollService.generate(
      request.user.sub,
      request.user.role,
      dto,
    );
  }

  @Patch('role-rates')
  @Roles('ADMIN')
  updateRoleRates(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateRoleRatesDto,
  ) {
    return this.payrollService.updateRoleRates(
      request.user.sub,
      request.user.role,
      dto,
    );
  }

  @Patch('rates/:employeeId')
  @Roles('ADMIN')
  updateRate(
    @Req() request: AuthenticatedRequest,
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() dto: UpdateStaffRateDto,
  ) {
    return this.payrollService.updateRate(
      request.user.sub,
      request.user.role,
      employeeId,
      dto,
    );
  }

  @Post('entries/:entryId/adjustments')
  createAdjustment(
    @Req() request: AuthenticatedRequest,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: CreatePayrollAdjustmentDto,
  ) {
    return this.payrollService.createAdjustment(
      request.user.sub,
      request.user.role,
      entryId,
      dto,
    );
  }

  @Delete('adjustments/:adjustmentId')
  deleteAdjustment(
    @Req() request: AuthenticatedRequest,
    @Param('adjustmentId', ParseIntPipe) adjustmentId: number,
  ) {
    return this.payrollService.deleteAdjustment(
      request.user.sub,
      request.user.role,
      adjustmentId,
    );
  }

  @Post('periods/:periodId/finalize')
  @Roles('ADMIN')
  finalize(
    @Req() request: AuthenticatedRequest,
    @Param('periodId', ParseIntPipe) periodId: number,
  ) {
    return this.payrollService.finalize(
      request.user.sub,
      request.user.role,
      periodId,
    );
  }

  @Post('periods/:periodId/mark-paid')
  @Roles('ADMIN')
  markPaid(
    @Req() request: AuthenticatedRequest,
    @Param('periodId', ParseIntPipe) periodId: number,
    @Body() dto: MarkPayrollPaidDto,
  ) {
    return this.payrollService.markPaid(
      request.user.sub,
      request.user.role,
      periodId,
      dto,
    );
  }
}
