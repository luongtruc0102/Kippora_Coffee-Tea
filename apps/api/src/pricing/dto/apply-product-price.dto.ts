import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ApplyProductPriceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  newPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
