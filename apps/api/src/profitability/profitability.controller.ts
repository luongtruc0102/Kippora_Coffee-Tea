import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ProfitabilityReportQueryDto } from './dto/profitability-report-query.dto';
import { ProfitabilityService } from './profitability.service';

@Roles('ADMIN')
@Controller('profitability')
export class ProfitabilityController {
  constructor(private readonly profitabilityService: ProfitabilityService) {}

  @Get('report')
  getReport(@Query() query: ProfitabilityReportQueryDto) {
    return this.profitabilityService.getReport(query);
  }
}
