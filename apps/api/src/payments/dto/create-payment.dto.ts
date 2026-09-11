import { IsIn, IsString } from 'class-validator';

// Kiểm tra phương thức thanh toán khi user tạo Payment
export class CreatePaymentDto {
  @IsString()
  @IsIn(['COD', 'BANK_TRANSFER'])
  method!: string;
}
