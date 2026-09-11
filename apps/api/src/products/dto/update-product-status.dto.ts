// src/products/dto/update-product-status.dto.ts
import { IsBoolean } from 'class-validator';

// Kiểm tra dữ liệu khi ADMIN khóa hoặc mở khóa sản phẩm
export class UpdateProductStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
