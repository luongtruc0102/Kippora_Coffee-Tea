import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CashSessionsService } from './cash-sessions.service';
import {
  ApproveCashSessionDto,
  CloseCashSessionDto,
  ReopenCashSessionDto,
} from './dto/close-cash-session.dto';
import { ListCashSessionsDto } from './dto/list-cash-sessions.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Roles('ADMIN', 'BRANCH_MANAGER')
@Controller('cash-sessions')
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListCashSessionsDto,
  ) {
    return this.cashSessionsService.findAll(
      request.user.sub,
      request.user.role,
      query,
    );
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cashSessionsService.findOne(
      request.user.sub,
      request.user.role,
      id,
    );
  }

  @Post('open')
  open(@Req() request: AuthenticatedRequest, @Body() dto: OpenCashSessionDto) {
    return this.cashSessionsService.open(
      request.user.sub,
      request.user.role,
      dto,
    );
  }

  @Post(':id/close')
  close(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cashSessionsService.close(
      request.user.sub,
      request.user.role,
      id,
      dto,
    );
  }

  @Roles('ADMIN')
  @Post(':id/approve')
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveCashSessionDto,
  ) {
    return this.cashSessionsService.approve(request.user.sub, id, dto);
  }

  @Roles('ADMIN')
  @Post(':id/reopen')
  reopen(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenCashSessionDto,
  ) {
    return this.cashSessionsService.reopen(request.user.sub, id, dto);
  }
}
