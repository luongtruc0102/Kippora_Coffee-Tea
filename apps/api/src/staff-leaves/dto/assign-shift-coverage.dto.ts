import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AssignShiftCoverageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  coveringEmployeeId!: number;
}
