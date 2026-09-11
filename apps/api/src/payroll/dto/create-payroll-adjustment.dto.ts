import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { StaffPayrollAdjustmentType } from '../../../generated/prisma/enums';

export class CreatePayrollAdjustmentDto {
  @IsIn(['BONUS', 'DEDUCTION'])
  type!: StaffPayrollAdjustmentType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000_000_000)
  amount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason!: string;
}
