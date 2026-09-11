import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAcceptingOrdersDto {
  @IsBoolean()
  isAcceptingOrders!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pauseReason?: string | null;
}
