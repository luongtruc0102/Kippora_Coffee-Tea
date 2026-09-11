import { IsInt, IsNumber, Min } from 'class-validator';

export class AdjustStockDto {
  @IsInt()
  @Min(1)
  branchId!: number;

  @IsInt()
  @Min(1)
  ingredientId!: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minimumLevel!: number;
}
