import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { InventoryVarianceReason } from '../../../generated/prisma/enums';

export class InventoryCountItemDto {
  @IsInt()
  @Min(1)
  ingredientId!: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  countedQuantity!: number;

  @IsOptional()
  @IsEnum(InventoryVarianceReason)
  reason?: InventoryVarianceReason;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class CreateInventoryCountDto {
  @IsInt()
  @Min(1)
  branchId!: number;

  @IsDateString()
  countedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => InventoryCountItemDto)
  items!: InventoryCountItemDto[];
}

export class UpdateInventoryCountDto extends CreateInventoryCountDto {}
