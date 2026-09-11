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
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

interface JwtUser {
  sub: number;
  email: string;
  role: string;
}

// JwtAuthGuard đã gắn thông tin user vào request
interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // Nhận GET /cart và lấy giỏ của user từ JWT, không nhận userId từ client.
  @Get()
  getCart(@Req() request: AuthenticatedRequest) {
    return this.cartService.getCart(request.user.sub);
  }

  // Nhận POST /cart/items; service sẽ tạo/tăng món và trả thêm addedItemId
  // để frontend chọn chính xác dòng món vừa được xử lý.
  @Post('items')
  addItem(
    @Req() request: AuthenticatedRequest,
    @Body() addCartItemDto: AddCartItemDto,
  ) {
    return this.cartService.addItem(request.user.sub, addCartItemDto);
  }

  // Nhận PATCH /cart/items/:id và cập nhật quantity của món thuộc user.
  @Patch('items/:id')
  updateItem(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(request.user.sub, id, updateCartItemDto);
  }

  // Nhận DELETE /cart/items/:id và xóa một món thuộc giỏ của user.
  @Delete('items/:id')
  removeItem(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cartService.removeItem(request.user.sub, id);
  }

  // Nhận DELETE /cart và xóa toàn bộ món nhưng không xóa bản ghi Cart.
  @Delete()
  clearCart(@Req() request: AuthenticatedRequest) {
    return this.cartService.clearCart(request.user.sub);
  }
}
