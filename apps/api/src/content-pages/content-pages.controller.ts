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
import { ContentPagesService } from './content-pages.service';
import { CreateContentPageDto } from './dto/create-content-page.dto';
import { ListContentPagesDto } from './dto/list-content-pages.dto';
import { UpdateContentPageStatusDto } from './dto/update-content-page-status.dto';
import { UpdateContentPageDto } from './dto/update-content-page.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('content-pages')
export class ContentPagesController {
  constructor(private readonly contentPagesService: ContentPagesService) {}

  @Public()
  @Get('navigation')
  getNavigation() {
    return this.contentPagesService.getNavigation();
  }

  @Roles('ADMIN')
  @Get('admin/all')
  findAllForAdmin(@Query() query: ListContentPagesDto) {
    return this.contentPagesService.findAllForAdmin(query);
  }

  @Roles('ADMIN')
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateContentPageDto,
  ) {
    return this.contentPagesService.create(request.user.sub, dto);
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentPageStatusDto,
  ) {
    return this.contentPagesService.updateStatus(
      request.user.sub,
      id,
      dto.isPublished,
    );
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentPageDto,
  ) {
    return this.contentPagesService.update(request.user.sub, id, dto);
  }

  @Public()
  @Get(':slug')
  findPublishedBySlug(@Param('slug') slug: string) {
    return this.contentPagesService.findPublishedBySlug(slug);
  }
}
