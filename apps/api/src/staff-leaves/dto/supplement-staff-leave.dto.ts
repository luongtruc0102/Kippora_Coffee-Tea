import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SupplementStaffLeaveDto {
  @IsString()
  @MinLength(5, { message: 'Nội dung bổ sung phải có ít nhất 5 ký tự' })
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^https?:\/\//, { message: 'Đường dẫn minh chứng không hợp lệ' })
  evidenceUrl?: string;
}
