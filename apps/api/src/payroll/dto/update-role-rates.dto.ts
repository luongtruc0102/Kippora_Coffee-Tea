import { Type } from 'class-transformer';
import { IsDefined, IsInt, Min, ValidateNested } from 'class-validator';
import { UpdateStaffRateDto } from './update-staff-rate.dto';

export class UpdateRoleRatesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateStaffRateDto)
  staff!: UpdateStaffRateDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateStaffRateDto)
  manager!: UpdateStaffRateDto;
}
