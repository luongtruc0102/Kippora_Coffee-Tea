import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListOperationalAlertsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn([
    'ALL',
    'INVENTORY',
    'PROCUREMENT',
    'FINANCE',
    'STAFFING',
    'PAYMENT',
    'ACCOUNTING',
    'SYSTEM',
  ])
  category?: string;

  @IsOptional()
  @IsIn(['ALL', 'CRITICAL', 'WARNING', 'INFO'])
  severity?: string;

  @IsOptional()
  @IsIn(['ALL', 'UNREAD', 'READ'])
  readStatus?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
