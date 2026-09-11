import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { InventoryVarianceReason } from '../../../generated/prisma/enums';

export class DisposeInventoryLotDto {
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsEnum(InventoryVarianceReason)
  reason!: InventoryVarianceReason;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
