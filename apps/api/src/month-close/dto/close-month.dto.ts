import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CloseMonthDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @Matches(MONTH_PATTERN, {
    message: 'Tháng chốt sổ phải có định dạng YYYY-MM',
  })
  month!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
