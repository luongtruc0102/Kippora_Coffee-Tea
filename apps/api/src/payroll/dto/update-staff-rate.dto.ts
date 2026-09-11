import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateStaffRateDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(25_500, { message: 'Lương giờ không được thấp hơn 25.500 đồng' })
  @Max(1_000_000)
  hourlyRate!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(5)
  overtimeMultiplier!: number;
}
