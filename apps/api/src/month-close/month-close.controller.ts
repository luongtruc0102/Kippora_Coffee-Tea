import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CloseMonthDto } from './dto/close-month.dto';
import { MonthCloseQueryDto } from './dto/month-close-query.dto';
import { ReopenMonthDto } from './dto/reopen-month.dto';
import { MonthCloseService } from './month-close.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Roles('ADMIN', 'BRANCH_MANAGER')
@Controller('month-close')
export class MonthCloseController {
  constructor(private readonly monthCloseService: MonthCloseService) {}

  @Get('overview')
  getOverview(
    @Req() request: AuthenticatedRequest,
    @Query() query: MonthCloseQueryDto,
  ) {
    return this.monthCloseService.getOverview(
      request.user.sub,
      request.user.role,
      query,
    );
  }

  @Post('close')
  @Roles('ADMIN')
  closeMonth(@Req() request: AuthenticatedRequest, @Body() dto: CloseMonthDto) {
    return this.monthCloseService.closeMonth(request.user.sub, dto);
  }

  @Post('reopen')
  @Roles('ADMIN')
  reopenMonth(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReopenMonthDto,
  ) {
    return this.monthCloseService.reopenMonth(request.user.sub, dto);
  }
}
