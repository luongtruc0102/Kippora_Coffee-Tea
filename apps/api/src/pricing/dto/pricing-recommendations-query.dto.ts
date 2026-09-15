import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PricingRecommendationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;
}
