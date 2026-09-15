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
import { ApplyProductPriceDto } from './dto/apply-product-price.dto';
import { ListPriceHistoryDto } from './dto/list-price-history.dto';
import { PricingRecommendationsQueryDto } from './dto/pricing-recommendations-query.dto';
import { UpdatePricingSettingsDto } from './dto/update-pricing-settings.dto';
import { PricingService } from './pricing.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Roles('ADMIN')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('recommendations')
  getRecommendations(@Query() query: PricingRecommendationsQueryDto) {
    return this.pricingService.getRecommendations(query);
  }

  @Get('history')
  getHistory(@Query() query: ListPriceHistoryDto) {
    return this.pricingService.getHistory(query);
  }

  @Patch('settings')
  updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdatePricingSettingsDto,
  ) {
    return this.pricingService.updateSettings(request.user.sub, dto);
  }

  @Post('variants/:id/apply')
  applyPrice(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyProductPriceDto,
  ) {
    return this.pricingService.applyPrice(request.user.sub, id, dto);
  }
}
