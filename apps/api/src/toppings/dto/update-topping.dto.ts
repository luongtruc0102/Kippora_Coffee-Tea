// src/toppings/dto/update-topping.dto.ts
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Kiểm tra dữ liệu client gửi lên khi cập nhật topping
export class UpdateToppingDto {
  // Các trường đều optional vì client có thể chỉ sửa một phần thông tin
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
