import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { InventoryService } from './inventory.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get()
  overview(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
  ) {
    const parsed = branchId ? Number(branchId) : undefined;
    if (parsed !== undefined && (!Number.isInteger(parsed) || parsed < 1)) {
      throw new BadRequestException('Chi nhánh không hợp lệ');
    }
    return this.inventoryService.getOverview(
      request.user.sub,
      request.user.role,
      parsed,
    );
  }

  @Roles('ADMIN')
  @Post('ingredients')
  createIngredient(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateIngredientDto,
  ) {
    return this.inventoryService.createIngredient(dto, request.user.sub);
  }

  @Roles('ADMIN')
  @Get('recipes')
  recipes() {
    return this.inventoryService.getRecipes();
  }

  @Roles('ADMIN')
  @Put('recipes/variants/:id')
  updateVariantRecipe(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.inventoryService.updateVariantRecipe(id, dto, request.user.sub);
  }

  @Roles('ADMIN')
  @Put('recipes/toppings/:id')
  updateToppingRecipe(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.inventoryService.updateToppingRecipe(id, dto, request.user.sub);
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Put('stock')
  updateMinimumLevel(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.updateMinimumLevel(
      request.user.sub,
      request.user.role,
      dto,
    );
  }
}
