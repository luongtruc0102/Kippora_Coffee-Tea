// src/categories/dto/update-category.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

// Kiểm tra dữ liệu client gửi lên khi cập nhật danh mục
export class UpdateCategoryDto {
  // Cho phép cập nhật tên, nhưng nếu có gửi lên thì phải hợp lệ
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  // Mô tả là trường không bắt buộc
  @IsOptional()
  @IsString()
  description?: string;
}
