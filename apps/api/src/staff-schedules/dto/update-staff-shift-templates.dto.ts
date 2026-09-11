import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { StaffShiftPeriod } from '../../../generated/prisma/enums';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class StaffShiftTemplateItemDto {
  @IsEnum(StaffShiftPeriod)
  period!: StaffShiftPeriod;

  @Matches(TIME_PATTERN, { message: 'startTime phải có định dạng HH:mm' })
  startTime!: string;

  @Matches(TIME_PATTERN, { message: 'endTime phải có định dạng HH:mm' })
  endTime!: string;
}

export class UpdateStaffShiftTemplatesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId!: number;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => StaffShiftTemplateItemDto)
  templates!: StaffShiftTemplateItemDto[];
}
