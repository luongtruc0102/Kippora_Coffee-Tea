import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewAttendancePeriodDto {
  @IsIn(['APPROVE', 'RETURN'])
  action!: 'APPROVE' | 'RETURN';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
