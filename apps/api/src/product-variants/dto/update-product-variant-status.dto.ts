import { IsBoolean } from 'class-validator';

// Kiểm tra dữ liệu khi khóa hoặc mở khóa variant
export class UpdateProductVariantStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
