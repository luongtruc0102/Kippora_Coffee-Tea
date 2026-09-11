import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';

export class ListStaffSchedulesDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'weekStart phải có định dạng YYYY-MM-DD',
  })
  weekStart!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;
}
