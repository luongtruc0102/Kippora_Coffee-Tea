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
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { BannersService } from './banners.service';
import { BannerQueryDto } from './dto/banner-query.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { ListBannersDto } from './dto/list-banners.dto';
import { UpdateBannerStatusDto } from './dto/update-banner-status.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Roles('ADMIN')
  @Get('admin/all')
  findAllForAdmin(@Query() query: ListBannersDto) {
    return this.bannersService.findAllForAdmin(query);
  }

  @Roles('ADMIN')
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateBannerDto) {
    return this.bannersService.create(request.user.sub, dto);
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBannerStatusDto,
  ) {
    return this.bannersService.updateStatus(request.user.sub, id, dto.isActive);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBannerDto,
  ) {
    return this.bannersService.update(request.user.sub, id, dto);
  }

  @Public()
  @Get()
  findPublic(@Query() query: BannerQueryDto) {
    return this.bannersService.findPublic(query.branchId);
  }
}
