import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateStoreSettingsDto {
  @IsOptional()
  @IsBoolean()
  isAcceptingOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  deliveryEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pickupEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'openingTime phải có định dạng HH:mm',
  })
  openingTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'closingTime phải có định dạng HH:mm',
  })
  closingTime?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  preparationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxDeliveryDistanceKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(100)
  deliveryBaseDistanceKm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  deliveryBaseFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  deliveryFeePerKm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  deliveryDiscountFirstThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  deliveryDiscountFirstAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  deliveryDiscountSecondThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  deliveryDiscountSecondAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pauseReason?: string | null;
}
