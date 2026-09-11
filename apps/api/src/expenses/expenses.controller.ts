import {
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
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';
import { ReviewExpenseDto } from './dto/review-expense.dto';
import { ExpensesService } from './expenses.service';

interface AuthenticatedRequest extends Request {
  user: { sub: number; role: string };
}

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListExpensesDto,
  ) {
    return this.expensesService.findAll(
      request.user.sub,
      request.user.role,
      query,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(
      request.user.sub,
      request.user.role,
      dto,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Put(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(
      request.user.sub,
      request.user.role,
      id,
      dto,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post(':id/submit')
  submit(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.expensesService.submit(request.user.sub, request.user.role, id);
  }

  @Roles('ADMIN')
  @Post(':id/review')
  review(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewExpenseDto,
  ) {
    return this.expensesService.review(
      request.user.sub,
      request.user.role,
      id,
      dto,
    );
  }

  @Roles('ADMIN', 'BRANCH_MANAGER')
  @Post(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.expensesService.cancel(request.user.sub, request.user.role, id);
  }
}
