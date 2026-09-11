// src/categories/dto/update-category-status.dto.ts
import { IsBoolean } from 'class-validator';

// Kiểm tra dữ liệu khi ADMIN khóa hoặc mở khóa danh mục
export class UpdateCategoryStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
