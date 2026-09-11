import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ExpenseCategory,
  ExpensePaymentMethod,
} from '../../../generated/prisma/enums';

export class CreateExpenseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId!: number;

  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsEnum(ExpensePaymentMethod)
  paymentMethod!: ExpensePaymentMethod;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000_000)
  amount!: number;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  incurredOn!: string;

  @IsString()
  @MaxLength(180)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateExpenseDto extends CreateExpenseDto {}
