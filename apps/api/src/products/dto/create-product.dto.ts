// src/products/dto/create-product.dto.ts
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Kiểm tra dữ liệu client gửi lên khi tạo sản phẩm mới
export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // Mô tả sản phẩm không bắt buộc
  @IsOptional()
  @IsString()
  description?: string;

  // Giá sản phẩm phải là số và không được nhỏ hơn 0
  @IsNumber()
  @Min(0)
  price!: number;

  // Link hình ảnh sản phẩm không bắt buộc
  @IsOptional()
  @IsString()
  imageUrl?: string;

  // Sản phẩm bắt buộc phải thuộc một danh mục
  @IsInt()
  categoryId!: number;
}
