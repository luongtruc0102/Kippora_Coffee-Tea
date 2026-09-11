import {
  Body,
  Controller,
  Delete,
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

import { SearchQueryDto } from '../common/dto/search-query.dto';

import { CreateOrderReviewDto } from './dto/create-order-review.dto';

import { UpdateOrderReviewDto } from './dto/update-order-review.dto';

import { UpdateReviewVisibilityDto } from './dto/update-review-visibility.dto';

import { ReviewsService } from './reviews.service';

import { ProductReviewsQueryDto } from './dto/product-reviews-query.dto';

import { ReplyReviewDto } from './dto/reply-review.dto';

interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    email: string;
    role: string;
  };
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Khách tạo đánh giá cho một đơn hàng đã hoàn tất.
  @Roles('USER', 'STAFF')
  @Post('orders/:orderId')
  create(
    @Req()
    request: AuthenticatedRequest,

    @Param('orderId', ParseIntPipe)
    orderId: number,

    @Body()
    dto: CreateOrderReviewDto,
  ) {
    return this.reviewsService.create(request.user.sub, orderId, dto);
  }

  // Khách xem đánh giá của mình trong một đơn.
  @Roles('USER', 'STAFF')
  @Get('orders/:orderId/mine')
  findMineForOrder(
    @Req()
    request: AuthenticatedRequest,

    @Param('orderId', ParseIntPipe)
    orderId: number,
  ) {
    return this.reviewsService.findMineForOrder(request.user.sub, orderId);
  }

  // Menu lấy điểm trung bình của tất cả sản phẩm trong một request.
  @Public()
  @Get('products/summaries')
  findProductReviewSummaries() {
    return this.reviewsService.findProductReviewSummaries();
  }

  // API công khai để menu và trang sản phẩm tải đánh giá.
  @Public()
  @Get('products/:productId')
  findProductReviews(
    @Param('productId', ParseIntPipe)
    productId: number,

    @Query()
    query: ProductReviewsQueryDto,
  ) {
    return this.reviewsService.findProductReviews(
      productId,
      query.rating,
      query.page,
      query.limit,
    );
  }

  // ADMIN xem toàn bộ đánh giá.
  @Roles('ADMIN')
  @Get('management/all')
  findAllForAdmin(
    @Query()
    query: SearchQueryDto,
  ) {
    return this.reviewsService.findAllForAdmin(query.q);
  }

  // ADMIN ẩn hoặc hiện lại đánh giá.
  @Roles('ADMIN')
  @Patch('management/:id/visibility')
  updateVisibility(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateReviewVisibilityDto,
  ) {
    return this.reviewsService.updateVisibility(id, dto.isVisible);
  }

  // ADMIN thêm hoặc sửa phản hồi chính thức.
  @Roles('ADMIN')
  @Patch('management/:id/reply')
  replyReview(
    @Req()
    request: AuthenticatedRequest,

    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: ReplyReviewDto,
  ) {
    return this.reviewsService.replyReview(request.user.sub, id, dto.reply);
  }

  // ADMIN xóa phản hồi của cửa hàng.
  @Roles('ADMIN')
  @Delete('management/:id/reply')
  removeReply(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.reviewsService.removeReply(id);
  }

  // Khách sửa đánh giá của chính mình.
  @Roles('USER', 'STAFF')
  @Patch(':id')
  update(
    @Req()
    request: AuthenticatedRequest,

    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateOrderReviewDto,
  ) {
    return this.reviewsService.update(request.user.sub, id, dto);
  }

  // Khách xóa đánh giá của chính mình.
  @Roles('USER', 'STAFF')
  @Delete(':id')
  remove(
    @Req()
    request: AuthenticatedRequest,

    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.reviewsService.remove(request.user.sub, id);
  }
}
