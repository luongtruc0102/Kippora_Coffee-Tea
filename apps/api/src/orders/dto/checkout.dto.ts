import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Kiểm tra thông tin khi người dùng checkout
export class CheckoutDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  branchId?: number;

  // Checkout thường truyền các CartItem khách đã chọn.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  cartItemIds?: number[];

  // Mua lại truyền đơn nguồn và OrderItem thay vì tạo CartItem tạm.
  @IsOptional()
  @IsInt()
  @Min(1)
  reorderOrderId?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  reorderOrderItemIds?: number[];

  @IsString()
  @MinLength(2)
  receiverName!: string;

  @IsString()
  @MinLength(8)
  receiverPhone!: string;

  @IsIn(['DELIVERY', 'PICKUP'])
  fulfillmentMethod!: 'DELIVERY' | 'PICKUP';

  @IsString()
  @MinLength(5)
  deliveryAddress!: string;

  // Tọa độ được lấy từ báo giá giao hàng; backend vẫn tính lại quãng đường.
  @IsLatitude()
  deliveryLatitude!: string;

  @IsLongitude()
  deliveryLongitude!: string;

  @IsIn(['COD', 'BANK_TRANSFER'])
  paymentMethod!: 'COD' | 'BANK_TRANSFER';

  // Ghi chú cho đơn hàng, ví dụ: ít đá, gọi trước khi giao...
  @IsOptional()
  @IsString()
  note?: string;

  // Mã giảm giá không bắt buộc
  @IsOptional()
  @IsString()
  voucherCode?: string;

  // Một đơn được dùng tối đa hai voucher khác nhau
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsString({ each: true })
  voucherCodes?: string[];

  // Số điểm khách muốn sử dụng
  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyPointsToUse?: number;
}
