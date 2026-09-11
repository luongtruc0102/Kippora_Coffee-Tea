import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Roles('ADMIN', 'BRANCH_MANAGER')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListAuditLogsDto,
  ) {
    return this.auditLogsService.findAll(
      request.user.sub,
      request.user.role,
      query,
    );
  }
}
