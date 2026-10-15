import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class DeliveryQuoteDto {
  @IsString()
  @MinLength(5)
  deliveryAddress!: string;

  @IsNumber()
  @Min(0)
  subtotal!: number;

  @IsOptional()
  @IsIn(['DELIVERY', 'PICKUP'])
  fulfillmentMethod?: 'DELIVERY' | 'PICKUP';

  @IsOptional()
  @IsInt()
  @Min(1)
  branchId?: number;
}
