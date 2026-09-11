import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export type StaffLeaveReviewAction = 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';

export class ReviewStaffLeaveDto {
  @IsIn(['APPROVED', 'REJECTED', 'NEEDS_INFO'])
  action!: StaffLeaveReviewAction;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  coveringEmployeeId?: number;
}
