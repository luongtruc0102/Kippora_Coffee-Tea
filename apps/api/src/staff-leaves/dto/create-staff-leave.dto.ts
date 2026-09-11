import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  StaffLeaveScope,
  StaffLeaveType,
} from '../../../generated/prisma/enums';

export class CreateStaffLeaveDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  staffShiftId!: number;

  @IsEnum(StaffLeaveType)
  type!: StaffLeaveType;

  @IsOptional()
  @IsEnum(StaffLeaveScope)
  scope?: StaffLeaveScope;

  @IsOptional()
  @IsISO8601()
  requestedStartAt?: string;

  @IsOptional()
  @IsISO8601()
  requestedEndAt?: string;

  @IsString()
  @MinLength(5, { message: 'Lý do xin nghỉ phải có ít nhất 5 ký tự' })
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^https?:\/\//, { message: 'Đường dẫn minh chứng không hợp lệ' })
  evidenceUrl?: string;
}
