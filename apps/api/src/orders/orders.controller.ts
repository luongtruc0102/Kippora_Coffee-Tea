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
import { AddressSuggestionsDto } from './dto/address-suggestions.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { DeliveryLocationQuoteDto } from './dto/delivery-location-quote.dto';
import { DeliveryQuoteDto } from './dto/delivery-quote.dto';
import { OrdersService } from './orders.service';
import { Patch } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { CreatePosOrderDto } from './dto/create-pos-order.dto';
import { PosCustomerLookupDto } from './dto/pos-customer-lookup.dto';
import { CancelManagedOrderDto } from './dto/cancel-managed-order.dto';

interface JwtUser {
  sub: number;
  email: string;
  role: string;
}

// JwtAuthGuard đã gắn payload JWT vào request.user
interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Backend geocode địa chỉ và tính khoảng cách/phí giao hàng.
  @Post('delivery-quote')
  quoteDelivery(@Body() deliveryQuoteDto: DeliveryQuoteDto) {
    return this.ordersService.quoteDelivery(deliveryQuoteDto);
  }

  // Gợi ý địa chỉ Việt Nam khi khách nhập trên checkout.
  @Get('address-suggestions')
  searchAddressSuggestions(
    @Query() addressSuggestionsDto: AddressSuggestionsDto,
  ) {
    return this.ordersService.searchAddressSuggestions(
      addressSuggestionsDto.query,
    );
  }

  // Tính tuyến từ tọa độ khách chọn trên bản đồ và lấy lại tên địa chỉ.
  @Post('delivery-location-quote')
  quoteDeliveryLocation(
    @Body() deliveryLocationQuoteDto: DeliveryLocationQuoteDto,
  ) {
    return this.ordersService.quoteDeliveryLocation(deliveryLocationQuoteDto);
  }

  // Tạo đơn hàng từ giỏ hàng của user đang đăng nhập
  @Post('checkout')
  checkout(
    @Req() request: AuthenticatedRequest,
    @Body() checkoutDto: CheckoutDto,
  ) {
    return this.ordersService.checkout(request.user.sub, checkoutDto);
  }

  // Trưởng chi nhánh tạo hóa đơn tại quầy, không đi qua giỏ hàng của user.
  @Roles('BRANCH_MANAGER')
  @Post('pos')
  createPosOrder(
    @Req() request: AuthenticatedRequest,
    @Body() createPosOrderDto: CreatePosOrderDto,
  ) {
    return this.ordersService.createPosOrder(
      request.user.sub,
      createPosOrderDto,
    );
  }

  // Tra tên và điểm theo SĐT để lần mua sau nhân viên không phải nhập lại tên.
  @Roles('BRANCH_MANAGER')
  @Get('pos/customers/lookup')
  lookupPosCustomer(@Query() query: PosCustomerLookupDto) {
    return this.ordersService.lookupPosCustomer(query.phone);
  }

  // Lấy lịch sử đơn hàng của user hiện tại
  @Get()
  findMyOrders(@Req() request: AuthenticatedRequest) {
    return this.ordersService.findMyOrders(request.user.sub);
  }

  // User tự hủy đơn của mình khi đơn vẫn đang chờ cửa hàng xác nhận
  @Patch(':id/cancel')
  cancelMyOrder(
    @Req() request: AuthenticatedRequest,
    @Body() cancelOrderDto: CancelOrderDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.cancelMyOrder(
      request.user.sub,
      id,
      cancelOrderDto.reason,
    );
  }

  // Mua lại chỉ khôi phục cấu hình món; không sao chép ưu đãi hay thông tin checkout cũ.
  @Post(':id/reorder')
  reorderMyOrder(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.reorderMyOrder(request.user.sub, id);
  }

  // Chỉ ADMIN và trưởng chi nhánh được xem danh sách đơn để vận hành.
  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('management/all')
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: SearchQueryDto,
  ) {
    return this.ordersService.findAll(
      query.q,
      request.user.role === 'BRANCH_MANAGER' ? request.user.sub : undefined,
    );
  }

  // Lấy chi tiết một đơn nhưng chỉ khi nó thuộc user hiện tại
  @Get(':id')
  findMyOrder(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.findMyOrder(request.user.sub, id);
  }

  // Chỉ ADMIN và trưởng chi nhánh xem chi tiết đơn quản lý.
  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get('management/:id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.findOne(
      id,
      request.user.role === 'BRANCH_MANAGER' ? request.user.sub : undefined,
    );
  }

  // Chỉ ADMIN và trưởng chi nhánh được chuyển trạng thái đơn.
  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Patch('management/:id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(
      id,
      updateOrderStatusDto.status,
      request.user.role === 'BRANCH_MANAGER' ? request.user.sub : undefined,
    );
  }

  // Hủy đơn quản lý; đơn đã thu tiền sẽ hoàn toàn bộ trong cùng giao dịch.
  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Patch('management/:id/cancel')
  cancelManagedOrder(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelManagedOrderDto,
  ) {
    return this.ordersService.cancelManagedOrder(
      request.user.sub,
      request.user.role,
      id,
      dto,
    );
  }
}
