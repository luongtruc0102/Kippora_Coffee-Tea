import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CloseCashSessionDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2_000_000_000)
  actualCash!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ApproveCashSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReopenCashSessionDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
