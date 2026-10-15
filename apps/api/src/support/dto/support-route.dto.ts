import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class SupportRouteDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderId?: number;
}
