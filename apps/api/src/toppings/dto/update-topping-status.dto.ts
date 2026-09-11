// src/toppings/dto/update-topping-status.dto.ts
import { IsBoolean } from 'class-validator';

// Kiểm tra dữ liệu khi ADMIN khóa hoặc mở khóa topping
export class UpdateToppingStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
