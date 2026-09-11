import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StockReceiptItemDto {
  @IsInt()
  @Min(1)
  ingredientId!: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  batchCode?: string;

  @IsOptional()
  @IsDateString()
  manufacturedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lotNote?: string;
}

export class CreateStockReceiptDto {
  @IsInt()
  @Min(1)
  branchId!: number;

  @IsInt()
  @Min(1)
  supplierId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StockReceiptItemDto)
  items!: StockReceiptItemDto[];
}

export class UpdateStockReceiptDto extends CreateStockReceiptDto {}
