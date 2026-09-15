import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { ListOperationalAlertsDto } from './dto/list-operational-alerts.dto';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    email: string;
    role: string;
  };
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.findMine(
      request.user.sub,
      request.user.role,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('operational')
  findOperational(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListOperationalAlertsDto,
  ) {
    return this.notificationsService.findOperational(
      request.user.sub,
      request.user.role,
      query,
    );
  }

  // Route cố định phải đứng trước :id/read để không bị hiểu "read-all" là ID.
  @Patch('read-all')
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(request.user.sub);
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Patch('operational/read-all')
  markAllOperationalRead(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAllOperationalRead(request.user.sub);
  }

  @Patch(':id/read')
  markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.markRead(request.user.sub, id);
  }
}
