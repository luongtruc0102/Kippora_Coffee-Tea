import { IsInt, Min } from 'class-validator';

export class AssignBranchManagerDto {
  @IsInt()
  @Min(1)
  userId!: number;
}
