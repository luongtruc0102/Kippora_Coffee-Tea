import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class DeliveryLocationQuoteDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsNumber()
  @Min(0)
  subtotal!: number;

  @IsOptional()
  @IsIn(['DELIVERY', 'PICKUP'])
  fulfillmentMethod?: 'DELIVERY' | 'PICKUP';

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  branchId?: number;
}
