import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class UpdatePricingSettingsDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(95)
  targetMarginPercent!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  costIncreaseAlertPercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10000)
  roundingStep!: number;
}
