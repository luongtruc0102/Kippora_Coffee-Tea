import { IsInt, Min } from 'class-validator';

// Hiện tại chỉ cho phép cập nhật số lượng của CartItem
export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  quantity!: number;
}
