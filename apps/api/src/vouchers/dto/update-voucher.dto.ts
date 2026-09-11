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

// DTO dùng để kiểm tra dữ liệu khi ADMIN cập nhật voucher
export class UpdateVoucherDto {
  // Mã voucher, ví dụ: SALE20
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  // Nội dung mô tả voucher
  @IsOptional()
  @IsString()
  description?: string;

  // Kiểu giảm giá: theo phần trăm hoặc số tiền cố định
  @IsOptional()
  @IsString()
  @IsIn(['PERCENT', 'FIXED'])
  discountType?: string;

  // Giá trị giảm giá
  // PERCENT: phần trăm giảm
  // FIXED: số tiền giảm trực tiếp
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  // Giá trị đơn hàng tối thiểu để được áp dụng voucher
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number | null;

  // Số tiền được giảm tối đa, thường dùng cho voucher PERCENT
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number | null;

  // Tổng số lượt voucher được phép sử dụng
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  // Thời điểm voucher bắt đầu có hiệu lực
  @IsOptional()
  @IsDateString()
  startAt?: string;

  // Thời điểm voucher hết hiệu lực
  @IsOptional()
  @IsDateString()
  endAt?: string;
}
