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
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { ListSupportConversationsDto } from './dto/list-support-conversations.dto';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { SupportRouteDto } from './dto/support-route.dto';
import { SupportMetricsQueryDto } from './dto/support-metrics-query.dto';
import { TransferSupportConversationDto } from './dto/transfer-support-conversation.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { SupportService } from './support.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Roles('USER', 'STAFF', 'BRANCH_MANAGER')
  @Get('me/unread-count')
  getMyUnreadCount(@Req() request: AuthenticatedRequest) {
    return this.supportService.getCustomerUnreadCount(request.user.sub);
  }

  @Roles('USER', 'STAFF', 'BRANCH_MANAGER')
  @Get('me')
  getMine(
    @Req() request: AuthenticatedRequest,
    @Query() route: SupportRouteDto,
  ) {
    return this.supportService.getCustomerConversation(request.user.sub, route);
  }

  @Roles('USER', 'STAFF', 'BRANCH_MANAGER')
  @Post('me/messages')
  sendMine(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportService.sendCustomerMessage(
      request.user.sub,
      dto.content,
      { branchId: dto.branchId, orderId: dto.orderId },
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('management/conversations')
  listForManagement(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListSupportConversationsDto,
  ) {
    return this.supportService.listForManagement(
      request.user.sub,
      request.user.role,
      query,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('management/metrics')
  getManagementMetrics(
    @Req() request: AuthenticatedRequest,
    @Query() query: SupportMetricsQueryDto,
  ) {
    return this.supportService.getManagementMetrics(
      request.user.sub,
      request.user.role,
      query,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('management/conversations/:id')
  getForManagement(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.supportService.getForManagement(
      request.user.sub,
      request.user.role,
      id,
      request.user.role !== 'ADMIN',
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Patch('management/conversations/:id/branch')
  transferConversation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransferSupportConversationDto,
  ) {
    return this.supportService.transferConversation(
      request.user.sub,
      request.user.role,
      id,
      dto.branchId,
    );
  }

  @Roles('BRANCH_MANAGER')
  @Post('management/conversations/:id/messages')
  sendForBranchManager(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportService.sendBranchManagerMessage(
      request.user.sub,
      id,
      dto.content,
    );
  }

  @Roles('BRANCH_MANAGER')
  @Patch('management/conversations/:id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupportStatusDto,
  ) {
    return this.supportService.updateStatus(request.user.sub, id, dto.status);
  }
}
