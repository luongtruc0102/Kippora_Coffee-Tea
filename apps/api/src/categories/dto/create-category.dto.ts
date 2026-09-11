import { IsOptional, IsString, MinLength } from 'class-validator';

// Kiểm tra dữ liệu client gửi lên khi tạo danh mục
export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // Mô tả không bắt buộc
  @IsOptional()
  @IsString()
  description?: string;
}
