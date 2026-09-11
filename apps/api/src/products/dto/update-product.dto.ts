// src/products/dto/update-product.dto.ts
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Kiểm tra dữ liệu client gửi lên khi cập nhật sản phẩm
export class UpdateProductDto {
  // Các trường đều optional vì client có thể chỉ sửa một phần thông tin
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  // Cho phép chuyển sản phẩm sang danh mục khác
  @IsOptional()
  @IsInt()
  categoryId?: number;
}
