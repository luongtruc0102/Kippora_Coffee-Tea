import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class OpenCashSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  openingFloat!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
