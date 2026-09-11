import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewPurchaseOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
