import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';

import { Request } from 'express';

import { FavoritesService } from './favorites.service';

interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    email: string;
    role: string;
  };
}

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  // GET /favorites/ids
  @Get('ids')
  findIds(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.favoritesService.findIds(request.user.sub);
  }

  // GET /favorites
  @Get()
  findAll(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.favoritesService.findAll(request.user.sub);
  }

  // POST /favorites/:productId
  @Post(':productId')
  add(
    @Req()
    request: AuthenticatedRequest,

    @Param('productId', ParseIntPipe)
    productId: number,
  ) {
    return this.favoritesService.add(request.user.sub, productId);
  }

  // DELETE /favorites/:productId
  @Delete(':productId')
  remove(
    @Req()
    request: AuthenticatedRequest,

    @Param('productId', ParseIntPipe)
    productId: number,
  ) {
    return this.favoritesService.remove(request.user.sub, productId);
  }
}
