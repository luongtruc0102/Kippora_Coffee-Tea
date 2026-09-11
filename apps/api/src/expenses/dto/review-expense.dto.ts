import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewExpenseDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
