import { IsIn, IsString } from 'class-validator';

// Chỉ cho phép cập nhật sang những trạng thái đơn hàng hợp lệ.
export class UpdateOrderStatusDto {
  @IsString()
  @IsIn([
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'DELIVERING',
    'COMPLETED',
    'CANCELLED',
  ])
  status!: string;
}
