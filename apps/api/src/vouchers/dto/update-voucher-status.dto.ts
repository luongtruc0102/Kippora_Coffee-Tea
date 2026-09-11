import { IsBoolean } from 'class-validator';

// Kiểm tra dữ liệu khi ADMIN bật hoặc tắt voucher
export class UpdateVoucherStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
