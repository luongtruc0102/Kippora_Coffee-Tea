import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { Request } from 'express';

import { Roles } from '../common/decorators/roles.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    email: string;
    role: string;
  };
}

// Nhân viên thường cũng dùng giao diện khách và có sổ địa chỉ riêng.
@Roles('USER', 'STAFF')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  // GET /addresses
  @Get()
  findMine(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.addressesService.findMine(request.user.sub);
  }

  // POST /addresses
  @Post()
  create(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    dto: CreateAddressDto,
  ) {
    return this.addressesService.create(request.user.sub, dto);
  }

  // PATCH /addresses/:id
  @Patch(':id')
  update(
    @Req()
    request: AuthenticatedRequest,

    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateAddressDto,
  ) {
    return this.addressesService.update(request.user.sub, id, dto);
  }

  // PATCH /addresses/:id/default
  @Patch(':id/default')
  setDefault(
    @Req()
    request: AuthenticatedRequest,

    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.addressesService.setDefault(request.user.sub, id);
  }

  // DELETE /addresses/:id
  @Delete(':id')
  remove(
    @Req()
    request: AuthenticatedRequest,

    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.addressesService.remove(request.user.sub, id);
  }
}
