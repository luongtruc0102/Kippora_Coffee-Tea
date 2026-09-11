import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ToppingsService } from './toppings.service';
import { CreateToppingDto } from './dto/create-topping.dto';
import { UpdateToppingDto } from './dto/update-topping.dto';
import { UpdateToppingStatusDto } from './dto/update-topping-status.dto';

@Controller('toppings')
export class ToppingsController {
  constructor(private readonly toppingsService: ToppingsService) {}

  // Chỉ ADMIN được phép tạo topping mới
  @Roles('ADMIN')
  @Post()
  create(@Body() createToppingDto: CreateToppingDto) {
    return this.toppingsService.create(createToppingDto);
  }

  // API public để khách chưa đăng nhập vẫn xem được danh sách topping
  @Public()
  @Get()
  findAll() {
    return this.toppingsService.findAll();
  }

  // ParseIntPipe đảm bảo id trên URL là số hợp lệ
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.toppingsService.findOne(id);
  }

  // Chỉ ADMIN được cập nhật thông tin topping
  @Roles('ADMIN')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateToppingDto: UpdateToppingDto,
  ) {
    return this.toppingsService.update(id, updateToppingDto);
  }

  // Khóa hoặc mở lại topping thay vì xóa trực tiếp
  @Roles('ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateToppingStatusDto: UpdateToppingStatusDto,
  ) {
    return this.toppingsService.updateStatus(
      id,
      updateToppingStatusDto.isActive,
    );
  }

  // ToppingsController
  @Roles('ADMIN')
  @Get('admin/all')
  findAllForAdmin(@Query() query: SearchQueryDto) {
    return this.toppingsService.findAllForAdmin(query.q);
  }
}
