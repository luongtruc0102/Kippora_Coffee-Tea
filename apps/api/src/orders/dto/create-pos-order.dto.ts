import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreatePosOrderItemDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsInt()
  @Min(1)
  variantId!: number;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  toppingIds?: number[];
}

export class CreatePosOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreatePosOrderItemDto)
  items!: CreatePosOrderItemDto[];

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  customerPhone?: string;

  @IsIn(['CASH', 'BANK_TRANSFER'])
  paymentMethod!: 'CASH' | 'BANK_TRANSFER';

  // Khách cũ có thể đổi điểm ngay tại quầy theo cùng quy tắc checkout online.
  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyPointsToUse?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
