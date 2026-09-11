import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStaffShiftDto {
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
