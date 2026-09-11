import { IsIn, IsOptional, IsString } from 'class-validator';

// ADMIN/STAFF cập nhật trạng thái thanh toán
export class UpdatePaymentStatusDto {
  @IsString()
  @IsIn(['PENDING', 'PAID', 'FAILED', 'CANCELLED'])
  status!: string;

  // Mã giao dịch chỉ cần khi có thanh toán online/chuyển khoản
  @IsOptional()
  @IsString()
  transactionCode?: string;
}
