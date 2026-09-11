import { IsIn, IsInt, Min } from 'class-validator';

export class UpdateStaffAssignmentDto {
  @IsInt()
  @Min(1)
  branchId!: number;

  @IsIn(['STAFF', 'BRANCH_MANAGER'])
  role!: 'STAFF' | 'BRANCH_MANAGER';
}
