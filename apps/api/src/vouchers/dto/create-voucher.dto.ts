import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Kiểm tra dữ liệu khi ADMIN tạo voucher mới
export class CreateVoucherDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Chỉ chấp nhận 2 loại giảm giá hiện có
  @IsString()
  @IsIn(['PERCENT', 'FIXED'])
  discountType!: string;

  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  // Client gửi theo chuẩn ISO date string
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;
}
