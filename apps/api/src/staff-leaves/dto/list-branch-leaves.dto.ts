import { IsEnum, IsOptional } from 'class-validator';
import { StaffLeaveStatus } from '../../../generated/prisma/enums';

export class ListBranchLeavesDto {
  @IsOptional()
  @IsEnum(StaffLeaveStatus)
  status?: StaffLeaveStatus;
}
