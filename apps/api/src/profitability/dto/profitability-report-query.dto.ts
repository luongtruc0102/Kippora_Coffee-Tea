import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ProfitabilityReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @IsOptional()
  @Matches(DATE_PATTERN, {
    message: 'Ngày bắt đầu phải có định dạng YYYY-MM-DD',
  })
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, {
    message: 'Ngày kết thúc phải có định dạng YYYY-MM-DD',
  })
  to?: string;
}
